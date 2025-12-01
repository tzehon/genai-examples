#!/bin/bash

# Resolve bin directory and add to PATH so scripts can find each other
_bindir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
PATH="${_bindir}:${PATH}"

while getopts 'n:g:h' opt
do
  case "$opt" in
    n) name="$OPTARG" ;;
    g) makeCerts="$OPTARG" ;;
    ?|h)
      echo "Usage: $(basename $0) [-n clusterName] "
      exit 1
      ;;
  esac
done
shift "$(($OPTIND -1))"

name=${name:-myproject1-myreplicaset}
mdb="mdb_${name}.yaml"
makeCerts=${makeCerts:-true}

source "${_bindir}/../scripts/init.conf"
[[ ${demo} ]] && serviceType="NodePort"

ns="-n ${namespace}"
mdbKind="MongoDB"

n=0
max=30
while [ $n -lt $max ]
do
    out=$( kubectl ${ns} get svc | grep "${name}.*external" )
    if [[ $out != "" && $? == 0 ]]
    then
        break
    fi
    sleep 5
    n=$((n+1))
done
[[ $n == $max ]] && exit 1

n=0
max=30
while [ $n -lt $max ]
do
    out=$( kubectl ${ns} get svc | grep "${name}.*external.*pending" )
    if [[ $? == 1 ]]
    then
        kubectl ${ns} get $( kubectl ${ns} get svc -o name | grep "${name}.*external" )
        break
    fi
    sleep 5
    n=$((n+1))
done

[[ ${externalDomain} ]] && exit

hnwp=( $( get_hns.bash -n "${name}" ) )
if [[ $? != 0 ]]
then
    printf "\n%s\n" "* * * Error - cannot determine the external hostnames for splitHorizon or externalDomain"
    exit 1
fi

    cat "$mdb" | sed -e '/horizon/d' -e '/connectivity:/d' -e '/replicaSetHorizons:/d' > new
    echo "  connectivity:"                     >> new
    echo "    replicaSetHorizons:"             >> new
    echo "      -" \"horizon-1\": \"${hnwp[0]}\" >> new
    echo "      -" \"horizon-1\": \"${hnwp[1]}\" >> new
    echo "      -" \"horizon-1\": \"${hnwp[2]}\" >> new
    mv new "$mdb"
hn=( $( printf "${hnwp[*]%:*}" ) )
# now remake the certs - and re-apply
if [[ ${makeCerts} == true && ${#hn[@]} != 0 ]]
then
    "${PWD}/certs/make_cluster_certs.bash" "${name}" ${hn[@]}
    kubectl ${ns} apply -f "${PWD}/certs/certs_mdb-${name}-cert.yaml"
fi
exit
