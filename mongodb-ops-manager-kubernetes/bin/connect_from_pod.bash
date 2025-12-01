#!/bin/bash

# Resolve bin directory and add to PATH so scripts can find each other
_bindir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
PATH="${_bindir}:${PATH}"
source "${_bindir}/../scripts/init.conf"

while getopts 'n:lh' opt
do
  case "$opt" in
    n) name="$OPTARG" ;;
    l) ldap="-l"      ;;
    ?|h)
      echo "Usage: $(basename $0) [-n clusterName] "
      exit 1
      ;;
  esac
done
shift "$(($OPTIND -1))"

ns="-n $namespace"
mdbKind="MongoDB"

name=${name:-myproject1-myreplicaset}
type=$( kubectl $ns get ${mdbKind}/${name} -o jsonpath='{.spec.type}' )
if [[ "${type}" == "ShardedCluster" ]]
then
    sharded=1
    mongos="-mongos"
fi

version=$( kubectl $ns get ${mdbKind} ${name} -o jsonpath='{.spec.version}' )
# use mongo or mongosh (v6)
mongo=mongo
if [[ ${version%%.*} > 4 ]]
then
mongo=mongosh
fi

ics=$( get_connection_string.bash -n "${name}" -i $ldap )
fcs=${ics#*:}
printf "\n%s %s\n\n" "Connect String: ${fcs} "

path="$( kubectl $ns exec ${name}${mongos}-0 -c "mongodb-enterprise-database" -- find /var/lib/mongodb-mms-automation/ -name ${mongo} |grep "${mongoshVersion}")"
if [[ x${path}x == xx ]]
then
# update old mongosh
    printf "Updating mongosh\n"
    kubectl $ns exec ${name}${mongos}-0 -i -t -c "mongodb-enterprise-database" -- bash -c "curl -s https://downloads.mongodb.com/compass/mongosh-${mongoshVersion}-linux-x64.tgz -o /var/lib/mongodb-mms-automation/mongosh-${mongoshVersion}-linux-x64.tgz; cd /var/lib/mongodb-mms-automation/ ; tar -zxvf mongosh-${mongoshVersion}-linux-x64.tgz; rm mongosh-${mongoshVersion}-linux-x64.tgz"
    path="$( kubectl $ns exec ${name}${mongos}-0 -c "mongodb-enterprise-database" -- find /var/lib/mongodb-mms-automation/ -name ${mongo} |grep "${mongoshVersion}")"
fi
mongosh=$( printf "%s" $path)
eval "kubectl $ns exec ${name}${mongos}-0 -i -t -c "mongodb-enterprise-database" -- ${mongosh} ${fcs} "
