#!/bin/bash

# Timing functions (bash 3.x compatible - no associative arrays)
_start_time=$SECONDS
_step_names=()
_step_durations=()

format_duration() {
    local seconds=$1
    local mins=$((seconds / 60))
    local secs=$((seconds % 60))
    printf "%dm %02ds" $mins $secs
}

time_step() {
    local step_name="$1"
    local start=$SECONDS
    shift
    "$@"
    local rc=$?
    local duration=$((SECONDS - start))
    _step_names+=("$step_name")
    _step_durations+=($duration)
    return $rc
}

_get_duration() {
    local name="$1"
    local i
    for i in "${!_step_names[@]}"; do
        if [[ "${_step_names[$i]}" == "$name" ]]; then
            echo "${_step_durations[$i]}"
            return
        fi
    done
}

print_summary() {
    local total=$((SECONDS - _start_time))
    printf "\n%s\n" "=== Deployment Summary ==="
    # Print steps in order
    for step in "Operator" "Ops Manager" "Oplog DB" "Blockstore DB" "Organization" "ReplicaSet" "Sharded" "Hostname update"; do
        local duration=$(_get_duration "$step")
        if [[ -n "$duration" ]]; then
            printf "%-16s %s\n" "${step}:" "$(format_duration $duration)"
        fi
    done
    printf "%s\n" "--------------------------"
    printf "%-16s %s\n" "Total:" "$(format_duration $total)"
}

# argument if set to 1 will skipCertGen creating new certs for OM and the App DB
while getopts 'odsgh-:' opt
do
  case "$opt" in
    o)   OM="true"; Clusters="false" ;;
    d)   Clusters="true"; OM="false" ;;
    s|g) skipCertGen="-g" ;;
    -)
      case "${OPTARG}" in
        search) searchFlag="--search" ;;
        *)
          echo "Unknown option --${OPTARG}"
          exit 1
          ;;
      esac
      ;;
    ?|h)
      echo "Usage: $(basename $0) [-o] [-d] [-s|-g] [--search]"
      echo "     use -o to deploy the OM resource only"
      echo "     use -d to deploy the Cluster resources only"
      echo "     use -s -g to skip cert generation"
      echo "     use --search to deploy MongoDB Search nodes with ReplicaSet (Preview)"
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
time_step "Operator" "${d}/deploy_Operator.bash"
[[ $? != 0 ]] && exit 1

if [[ ${OM} == true ]]
then
printf "\n%s\n" "__________________________________________________________________________________________"
printf "%s\n" "Deploy OM and wait until Running status..."
date
    omOptions="-n ${omName} -c 1.00 -m 4Gi -d 40Gi -v ${omVersion} ${skipCertGen}"
time_step "Ops Manager" "${d}/deploy_OM.bash" ${omOptions}
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
    oplogOptions="-n oplog -p ${omName} -v ${appdbVersion} -c 0.50 -m 2.0Gi -d 40Gi -o ${omName}-db ${skipCertGen}"
    time_step "Oplog DB" "${d}/deploy_Cluster.bash" ${oplogOptions}
    printf "#deploy_Cluster.bash ${oplogOptions}\n" >> ${deployconf}

    printf "\n%s\n" "__________________________________________________________________________________________"
    printf "%s\n" "Create the Backup BlockStore DB for OM ..."
    date
    blockstoreOptions="-n blockstore -p ${omName} -v ${appdbVersion} -c 1.00 -m 4.0Gi -d 40Gi -o ${omName}-db ${skipCertGen}"
    time_step "Blockstore DB" "${d}/deploy_Cluster.bash" ${blockstoreOptions}
    printf "#deploy_Cluster.bash ${blockstoreOptions}\n" >> ${deployconf}
fi # backup true
fi # OM
[[ ${OM} == true && ${Clusters} == false ]] && { print_summary; exit; }

printf "\n%s\n" "__________________________________________________________________________________________"
printf "%s\n" "Create a specific Organization to put your Deployment projects in ..."
date
# Create the Org and put the info in ${deployconf}
time_step "Organization" "${d}/../bin/deploy_org.bash" -o "${deploymentOrgName}"
test -e ${deployconf} && source ${deployconf}
orgId="${deploymentOrgName//-/_}_orgId"
orgId="${!orgId}"

printf "\n%s\n" "__________________________________________________________________________________________"
printf "%s\n" "Create a Production ReplicaSet Cluster with a splitHorizon configuration for External access ..."
date
projectName="myProject1"
name="myreplicaset"
rsOptions="-n ${name} -v ${mdbVersion} -c 1.00 -m 4.0Gi -d 20Gi -l ${ldapType} -o ${deploymentOrgName} -p ${projectName} -e horizon ${skipCertGen} ${searchFlag}"
time_step "ReplicaSet" "${d}/deploy_Cluster.bash" ${rsOptions}
printf "#deploy_Cluster.bash ${rsOptions}\n" >> ${deployconf}
cluster1="${projectName}-${name}"

printf "\n%s\n" "__________________________________________________________________________________________"
printf "%s\n" "Create a Production Sharded Cluster  ..."
date
projectName="myProject2"
name="mysharded"
shOptions="-n ${name} -v ${mdbVersion} -c 0.50 -m 2Gi -d 4Gi -s 2 -r 2 -l ${ldapType} -o ${deploymentOrgName} -p ${projectName} -e mongos ${skipCertGen}"
time_step "Sharded" "${d}/deploy_Cluster.bash" ${shOptions}
printf "#deploy_Cluster.bash ${shOptions}\n" >> ${deployconf}
cluster2="${projectName}-${name}"

printf "\n%s\n" "__________________________________________________________________________________________"
printf "%s\n" "Update init.conf with IPs and put k8s internal hostnames in /etc/hosts ..."
time_step "Hostname update" "${d}/../bin/update_initconf_hostnames.bash" -o "${omName}" -r "${cluster1}" -s "${cluster2}"

date
print_summary
