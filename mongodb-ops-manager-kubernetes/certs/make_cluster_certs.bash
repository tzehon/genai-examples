#!/bin/bash

d=$( dirname "$0" )
cd "${d}"

name=${1:-myproject1-myreplicaset}
shift
dnsHorizon=( $@ )

# members=$( kubectl get mdb ${name} -o json|jq .spec.members )
# env vars provide externalDomain (for a cluster) and clusterDomain (k8s cluster domain)
members=3 # hard coded in template

n=0
if [[ ${externalDomain} == "" ]]
then
    while [ $n -lt $members ]
    do
        names[$n]="${name}-${n}.${name}-svc.${namespace}.svc.${clusterDomain}"
        n=$((n+1))
    done
else
    # external Domain
    while [ $n -lt $members ]
    do
        names[$n]="${name}-${n}.${externalDomain}"
        n=$((n+1))
    done
fi

"$PWD/gen_cert.bash" "mdb-${name}-cert" ${names[*]} ${dnsHorizon[*]}
