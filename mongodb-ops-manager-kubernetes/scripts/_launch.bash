#!/bin/bash

# argument if set to 1 will skipCertGen creating new certs for OM and the App DB
while getopts 'odsgh' opt
do
  case "$opt" in
    o)   OM="true"; Clusters="false" ;;
    d)   Clusters="true"; OM="false" ;;
    s|g) skipCertGen="-g" ;;
    ?|h)
      echo "Usage: $(basename $0) [-o ] [-s|-g]"
      echo "     use -o to deploy the OM resource"
      echo "     use -d to deploy the Cluster resources"
      echo "     use -s -g to skipCertGen cert generation"
      exit 1
      ;;
  esac
done
shift "$(($OPTIND -1))"

OM=${OM:-true}
Clusters=${Clusters:-true}

# Resolve to absolute path so script works when called from PATH
d=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd "${d}"
source init.conf

which kubectl > /dev/null
if [[ $? != 0 ]]
then
    printf "%s\n" "Exiting - Missing kubectl tool - (brew) install kubernetes-cli"
    exit 1
fi

kubectl api-resources > /dev/null 2>&1
if [[ $? != 0 ]]
then
    printf "%s\n" "Exiting - Check kubectl or cluster readiness"
    exit 1
fi

date
printf "\n%s\n" "__________________________________________________________________________________________"
context=$( kubectl config current-context )
printf "\n%s\n" "Using context: ${context}"


printf "\n%s\n" "__________________________________________________________________________________________"
printf "%s\n" "Deploy the Operator ..."
(set -x; "${d}/deploy_Operator.bash")
[[ $? != 0 ]] && exit 1

if [[ ${OM} == true ]]
then
printf "\n%s\n" "__________________________________________________________________________________________"
printf "%s\n" "Deploy OM and wait until Running status..."
date
    omOptions="-n ${omName} -c 1.00 -m 4Gi -d 40Gi -v ${omVersion} ${skipCertGen}"
(set -x; "${d}/deploy_OM.bash" ${omOptions})
printf "#deploy_OM.bash ${omOptions}\n" >> ${deployconf}

if [[ ${omBackup} == true ]]
then
    printf "\n%s\n" "__________________________________________________________________________________________"
    # put these resources in the same org as the AppDB
    (set -x; "${d}/../bin/deploy_org.bash" -o "${omName}-db" ) # -o newOrgName
    printf "Using Organization: ${omName}-db with orgName: ${omName}-db for the OM resources\n"
    printf "\n%s\n" "__________________________________________________________________________________________"
    printf "%s\n" "Create the Backup Oplog DB for OM ..."
    date
    oplogOptions="-n ${omName}-oplog -v ${appdbVersion} -c 0.50 -m 2.0Gi -d 40Gi -o ${omName}-db ${skipCertGen}"
(set -x; "${d}/deploy_Cluster.bash" ${oplogOptions})
printf "#deploy_Cluster.bash ${oplogOptions}\n" >> ${deployconf}

    printf "\n%s\n" "__________________________________________________________________________________________"
    printf "%s\n" "Create the Backup BlockStore DB for OM ..."
    date
    blockstoreOptions="-n ${omName}-blockstore -v ${appdbVersion} -c 1.00 -m 4.0Gi -d 40Gi -o ${omName}-db ${skipCertGen}"
(set -x; "${d}/deploy_Cluster.bash" ${blockstoreOptions})
printf "#deploy_Cluster.bash ${blockstoreOptions}\n" >> ${deployconf}
fi # backup true
fi # OM
[[ ${OM} == true && ${Clusters} == false ]] && exit

printf "\n%s\n" "__________________________________________________________________________________________"
printf "%s\n" "Create a specific Organization to put your Deployment projects in ..."
date
# Create the Org and put the info in ${deployconf}
(set -x; "${d}/../bin/deploy_org.bash" -o "${deploymentOrgName}" ) # -o newOrgName
test -e ${deployconf} && source ${deployconf}
orgId="${deploymentOrgName//-/_}_orgId"
orgId="${!orgId}"

printf "\n%s\n" "__________________________________________________________________________________________"
printf "%s\n" "Create a Production ReplicaSet Cluster with a splitHorizon configuration for External access ..."
date
projectName="myProject1"
name="myreplicaset"
rsOptions="-n ${name} -v ${mdbVersion} -c 1.00 -m 4.0Gi -d 20Gi -l ${ldapType} -o ${deploymentOrgName} -p ${projectName} -e horizon ${skipCertGen}"
(set -x; "${d}/deploy_Cluster.bash" ${rsOptions})
printf "#deploy_Cluster.bash ${rsOptions}\n" >> ${deployconf}
cluster1="${projectName}-${name}"

printf "\n%s\n" "__________________________________________________________________________________________"
printf "%s\n" "Create a Production Sharded Cluster  ..."
date
projectName="myProject2"
name="mysharded"
shOptions="-n ${name} -v ${mdbVersion} -c 0.50 -m 2Gi -d 4Gi -s 2 -r 2 -l ${ldapType} -o ${deploymentOrgName} -p ${projectName} -e mongos ${skipCertGen}"
(set -x; "${d}/deploy_Cluster.bash" ${shOptions})
printf "#deploy_Cluster.bash ${shOptions}\n" >> ${deployconf}
cluster2="${projectName}-${name}"

printf "\n%s\n" "__________________________________________________________________________________________"
printf "%s\n" "Update init.conf with IPs and put k8s internal hostnames in /etc/hosts ..."
(set -x; "${d}/../bin/update_initconf_hostnames.bash" -o "${omName}" -r "${cluster1}" -s "${cluster2}")

date
