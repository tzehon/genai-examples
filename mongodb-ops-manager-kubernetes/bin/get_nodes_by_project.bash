#!/bin/bash

# Resolve bin directory and add to PATH so scripts can find each other
_bindir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
PATH="${_bindir}:${PATH}"
source "${_bindir}/../scripts/init.conf"
source ${deployconf} 
projectId=$1


if [[ $projectId == "" ]] 
then
    printf "need projectId" 
    exit 1
fi


output=$( curl $curlOpts --silent --user "${publicKey}:${privateKey}" --digest \
  --header 'Accept: application/json' \
  --header 'Content-Type: application/json' \
  --request GET "${opsMgrExtUrl}/api/public/v1.0/groups/${projectId}/hosts?pretty=true" )

printf "%s" "$output" | jq '.results[]| .hostname,.systemInfo'
exit 0
