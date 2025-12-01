#!/bin/bash

# Resolve to absolute path so script works when called from PATH
d=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
cd "${d}"
source init.conf

verb=create
[[ $1 == "-d" ]] && verb=delete

# Cluster configuration
cluster="${MDB_CENTRAL_C:-mdb-central}"
gkeRegion="${MDB_CENTRAL_REGION:-us-west1}"
domain="${clusterDomain:-mdb.com}"
nodesPerRegion="2" # 2 nodes per zone x 3 zones = 6 total nodes
clusterType="e2-standard-8"

# Calculate expire date (3 days from now) - works on both macOS and Linux
if date -v+1d &>/dev/null; then
  expire=$(date -v+3d +%Y-%m-%d)  # macOS
else
  expire=$(date -d "+3 days" +%Y-%m-%d)  # Linux
fi

# e2-standard-2 2 core x  8 GB
# e2-standard-4 4 core x 16 GB
# e2-standard-8 8 core x 32 GB

if [[ $verb == "create" ]]
then
    echo "Creating GKE cluster: ${cluster} in ${gkeRegion}"
    set -x
    gcloud container clusters ${verb} ${cluster} --region="${gkeRegion}" \
        --cluster-dns="clouddns" \
        --cluster-dns-scope="vpc" \
        --cluster-dns-domain="${domain}" \
        --num-nodes=${nodesPerRegion} \
        --machine-type "${clusterType}" \
        --cluster-version="1.33" \
        --labels="expire-on=${expire},owner=tzehon_tan,purpose=opportunity,noreap=true" \
        --node-labels="expire-on=${expire},owner=tzehon_tan,purpose=opportunity,noreap=true"
    set +x
    gcloud container clusters get-credentials ${cluster} --region="${gkeRegion}"
    echo "Cluster ${cluster} created and credentials configured"
else
    echo "Deleting GKE cluster: ${cluster} in ${gkeRegion}"
    set -x
    printf 'y' | gcloud container clusters ${verb} ${cluster} --region="${gkeRegion}"
    set +x
    echo "Cluster ${cluster} deleted"
fi
