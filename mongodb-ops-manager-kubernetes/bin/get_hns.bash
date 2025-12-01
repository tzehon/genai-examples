#!/bin/bash

# Resolve bin directory and add to PATH so scripts can find each other
_bindir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
PATH="${_bindir}:${PATH}"
source "${_bindir}/../scripts/init.conf"

while getopts 'n:s:h' opts
do
  case "$opts" in
    n) name="$OPTARG" ;;
    s) sName="$OPTARG" ;;
    ?|h)
      echo "Usage: $(basename $0) -n Name "
      exit 1
      ;;
  esac
done
shift "$(($OPTIND -1))"

#name=${name:-myproject1-myreplicaset}

# Check if this is for a cluster otherwise assume it is the OM

serviceName=""
if [[ $name != "" ]]
then
    serviceName=${name}-0-svc-external
    type=$( kubectl -n ${namespace} get mdb/${name} -o jsonpath='{.spec.type}' 2>/dev/null )
    err1=$?
    if [[ $err1 != 0 ]]
    then
        serviceType=$( kubectl -n ${namespace} get om/${name} -o jsonpath='{.spec.externalConnectivity.type}' 2>/dev/null )
        err2=$?
        if [[ $err2 == 0 ]]
        then
            om=1
            serviceName=${name}-svc-ext
        fi
    else # we assume RepSet but lets check for RepSet vs Sharded
        om=0
        if [[ "${type}" == "ShardedCluster" ]]
        then
            serviceName=${name}-svc-external
        fi
    fi
else
    serviceName=$sName
    om=1
fi

serviceType=$( kubectl -n ${namespace} get svc/${serviceName} -o jsonpath='{.spec.type}' 2>/dev/null )
err3=$?

if [[ $err1 != 0 && $err2 != 0 && $err3 != 0 ]]
then
        printf "\n%s\n\n", "* * * Error - Service ${serviceName} for $name was not found"
        exit 1
fi

# Fail early if serviceType is empty - service not ready
if [[ -z "$serviceType" ]]
then
    printf "\n%s\n\n" "* * * Error - Service ${serviceName} has no type (service may not be ready)"
    exit 1
fi

if [[ "$serviceType" == "NodePort" ]]
then
    # NodePort: get ports from nodePort, hostnames from nodes
    if [[ "${type}" == "ShardedCluster" || ${om} == 1 ]]
    then
        np0=$( kubectl -n ${namespace} get svc/${serviceName} -o jsonpath='{.spec.ports[0].nodePort}' )
        np1=$np0
        np2=$np0
    else
        np0=$( kubectl -n ${namespace} get svc/${name}-0-svc-external -o jsonpath='{.spec.ports[0].nodePort}' )
        np1=$( kubectl -n ${namespace} get svc/${name}-1-svc-external -o jsonpath='{.spec.ports[0].nodePort}' )
        np2=$( kubectl -n ${namespace} get svc/${name}-2-svc-external -o jsonpath='{.spec.ports[0].nodePort}' )
    fi
    # Get hostnames from nodes for NodePort
    slist=( $(kubectl -n ${namespace} get nodes -o jsonpath='{.items[*].status.addresses[?(@.type=="Hostname")].address}') )
    if [[ ${slist[0]} == "docker-desktop" ]]
    then
        slist=( "localhost" )
    else
        slist=( $(kubectl -n ${namespace} get nodes -o jsonpath='{.items[*].status.addresses[?(@.type=="ExternalDNS")].address}' ) )
        if [[ ${#slist[@]} == 0 ]]
        then
            slist=( $(kubectl -n ${namespace} get nodes -o jsonpath='{.items[*].status.addresses[?(@.type=="Hostname")].address}') )
        fi
        if [[ ${#slist[@]} == 0 ]]
        then
            iplist=( $(kubectl -n ${namespace} get nodes -o jsonpath='{.items[*].status.addresses[?(@.type=="ExternalIP")].address}' ) )
            n=0
            for ip in ${iplist[*]}
            do
                slist[$n]=$( nslookup $ip|grep name|awk '{print $4}')
                n=$((n+1))
            done
        fi
        if [[ ${#slist[@]} == 0 && $custerType == "openshift" ]]
        then
            slist=( $(kubectl -n ${namespace} get nodes -o json | jq -r '.items[].metadata.labels | select((."node-role.kubernetes.io/infra" == null) and .storage == "pmem") | ."kubernetes.io/hostname" ' ) )
        fi
        if [[ ${#slist[@]} == 0 ]]
        then
            slist=( $(kubectl -n ${namespace} get nodes -o jsonpath='{.items[*].status.addresses[?(@.type=="InternalDNS")].address}' ) )
        fi
        if [[ ${#slist[@]} == 0 ]]
        then
            iplist=( $(kubectl -n ${namespace} get nodes -o jsonpath='{.items[*].status.addresses[?(@.type=="ExternalIP")].address}' ) )
            n=0
            for ip in ${iplist[*]}
            do
                slist[$n]=$( nslookup $ip|grep name|awk '{print $4}')
                n=$((n+1))
            done
        fi
    fi
elif [[ "$serviceType" == "LoadBalancer" ]]
then
    # LoadBalancer: get ports from port, hostnames from ingress
    if [[ "${type}" == "ShardedCluster" || ${om} == 1 ]]
    then
        np0=$( kubectl -n ${namespace} get svc/${serviceName} -o jsonpath='{.spec.ports[0].port}' )
        slist=( $( kubectl -n ${namespace} get svc/${serviceName} -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' ) )
        if [[ ${#slist[@]} == 0 ]]
        then
            # Use IP directly - don't try nslookup which can return internal K8s DNS names
            slist=( $(kubectl -n ${namespace} get svc/${serviceName} -o jsonpath='{.status.loadBalancer.ingress[*].ip }' ) )
        fi
    else
        # ReplicaSet: query each service individually in order to ensure correct mapping
        np0=$( kubectl -n ${namespace} get svc/${name}-0-svc-external -o jsonpath='{.spec.ports[0].port}' )
        np1=$( kubectl -n ${namespace} get svc/${name}-1-svc-external -o jsonpath='{.spec.ports[0].port}' )
        np2=$( kubectl -n ${namespace} get svc/${name}-2-svc-external -o jsonpath='{.spec.ports[0].port}' )

        # Get hostname/IP for each service individually to maintain order
        slist=()
        for i in 0 1 2; do
            hn=$( kubectl -n ${namespace} get svc/${name}-${i}-svc-external -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null )
            if [[ -z "$hn" ]]
            then
                ip=$( kubectl -n ${namespace} get svc/${name}-${i}-svc-external -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null )
                if [[ -n "$ip" ]]
                then
                    # Use external DNS (8.8.8.8) for PTR lookup - avoids K8s CoreDNS returning internal names
                    hn=$( nslookup $ip 8.8.8.8 2>/dev/null | grep 'name = ' | awk '{print $NF}' | sed 's/\.$//' )
                fi
            fi
            if [[ -z "$hn" ]]
            then
                printf "\n%s\n\n" "* * * Error - Cannot determine external hostname for ${name}-${i}-svc-external"
                exit 1
            fi
            slist+=("$hn")
        done
    fi
else
    printf "\n%s\n\n" "* * * Error - Unknown service type: ${serviceType}"
    exit 1
fi

num=${#slist[@]}

if [[ $num = 1 ]]
then
# single node cluster
    hn0=${slist[0]}
    hn1=${slist[0]#}
    hn2=${slist[0]#}
else
    hn0=${slist[0]}
    hn1=${slist[1]}
    hn2=${slist[2]}
fi
if [[ $sName != "" ]]
then
printf "%s %s %s" "$hn0:$np0"
else
printf "%s %s %s" "$hn0:$np0" "$hn1:$np1" "$hn2:$np2"
fi
