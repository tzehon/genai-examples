#!/bin/bash

# Resolve bin directory and add to PATH so scripts can find each other
_bindir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
_certsdir="${_bindir}/../certs"
PATH="${_bindir}:${PATH}"
source "${_bindir}/../scripts/init.conf"

while getopts 'n:lih' opt
do
  case "$opt" in
    n) name="$OPTARG" ;;
    i) internal=1     ;;
    l) ldap=1         ;;
    ?|h)
      echo "Usage: $(basename $0) [-n clusterName] "
      exit 1
      ;;
  esac
done
shift "$(($OPTIND -1))"

ns="-n ${namespace}"
mdbKind="MongoDB"

name=${name:-myproject1-myreplicaset}
internal=${internal:-0}

type=$( kubectl $ns get ${mdbKind}/${name} -o jsonpath='{.spec.type}' )
if [[ "${type}" == "ShardedCluster" ]]
then
    sharded=1
    mongos="-mongos"
    serviceType=$( kubectl $ns get svc/${name}${mongos}-0-svc-external -o jsonpath='{.spec.type}' 2>/dev/null )
else
    serviceType=$( kubectl $ns get svc/${name}-0-svc-external -o jsonpath='{.spec.type}' 2>/dev/null )
fi

ics=$( kubectl $ns get secret ${name}-${name}-admin-admin -o jsonpath="{.data['connectionString\.standard']}" | base64 --decode )
eval externalDomain=$( kubectl $ns get ${mdbKind} ${name} -o json | jq .spec.externalAccess.externalDomain );
# bug with connection string
if [[ ${externalDomain} != "null" ]]
then
    hn=( "${name}-0.${externalDomain}" \
         "${name}-1.${externalDomain}" \
         "${name}-2.${externalDomain}" )
    ics=$( printf "%s" "$ics" | sed -e "s?@.*/?@${hn[0]},${hn[1]},${hn[2]}/?" )
fi

if [[ $ldap == 1 ]]
then
    ics=${ics/SCRAM-SHA-256/PLAIN}
    ics=${ics/admin/\%24external}
fi
ecs="${ics}"
if [[ ${serviceType} != "" ]]
then

if [[ ${sharded} == 1 ]]
then
    hn=( $( get_hns.bash -s "${name}${mongos}-0-svc-external" ) )
    ecs=$( printf "%s" "$ics" | sed -e "s?:2701.?:${hn#*:}?g" )
elif [[ ${externalDomain} == "null" ]]
then
    hn=( $( get_hns.bash -n "${name}" ) )
    ecs=$( printf "%s" "$ics" | sed -e "s?@.*/?@${hn[0]},${hn[1]},${hn[2]}/?" )
fi
fi
# check to see is TLS on
spec=$( kubectl $ns get ${mdbKind}/${name} -o jsonpath='{.spec.security}' )
if [[ ${serviceType} != "" && ${internal} = 0 ]]
then
if [[ "${spec}" == "map[enabled:true]" || "${spec}" == *"refix":* || "${spec}" == *"ecret":* || "${spec}" == *\"ca\":* ]]
then
    test -e "${_certsdir}/ca.pem"               || kubectl $ns get configmap ca-pem -o jsonpath="{.data['ca-pem']}" > "${_certsdir}/ca.pem"
    kubectl $ns get secret mdb-${name}${mongos}-cert-pem -o jsonpath="{.data.*}" | base64 --decode > "${_certsdir}/${name}${mongos}.pem"
    eval version=$( kubectl $ns get ${mdbKind} ${name} -o jsonpath={.spec.version} )
    if [[ ${version%%.*} = 3 ]]
    then
        ssltls_enabled="&ssl=true&sslCAFile=${_certsdir}/ca.pem&sslPEMKeyFile=${_certsdir}/${name}${mongos}.pem "
    else
        ssltls_enabled="&tls=true&tlsCAFile=${_certsdir}/ca.pem&tlsCertificateKeyFile=${_certsdir}/${name}${mongos}.pem "
    fi
fi
    fcs=\'${ecs}${ssltls_enabled}\'
    printf "The connection string (external): "
    printf "%s\n" "${fcs}"

else # internal
if [[ "${spec}" == "map[enabled:true]" || "${spec}" == *"refix":* || "${spec}" == *"ecret":* || "${spec}" == *\"ca\":* ]]
then
    kv=$( kubectl $ns get secret mdb-${name}${mongos}-cert-pem -o jsonpath="{.data}" | grep -o '".*":*' )
    serverpem=$( eval printf ${kv%:*} )
    if [[ ${version%%.*} = 3 ]]
    then
        ssltls_enabled="&ssl=true&sslCAFile=/mongodb-automation/tls/ca/ca-pem&sslPEMKeyFile=/mongodb-automation/tls/${serverpem}"
    else
        ssltls_enabled="&tls=true&tlsCAFile=/mongodb-automation/tls/ca/ca-pem&tlsCertificateKeyFile=/mongodb-automation/tls/${serverpem}"
    fi
fi
    fcs=\'${ics}${ssltls_enabled}\'
    printf "The connection string (internal): "
    printf "%s\n" "${fcs}"
fi
