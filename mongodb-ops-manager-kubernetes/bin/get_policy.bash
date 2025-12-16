#!/bin/bash

# Resolve bin directory and add to PATH so scripts can find each other
_bindir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
PATH="${_bindir}:${PATH}"
source "${_bindir}/../scripts/init.conf"
test -f ${deployconf} && source ${deployconf}

while getopts 'p:h' opt
do
  case "$opt" in
    p) projectId="$OPTARG";;
    ?|h)
      echo "Usage: $(basename $0) -p projectId [-h]"
      exit 1
      ;;
  esac
done

output=$( curl $curlOpts --silent --user "${publicKey}:${privateKey}" --digest \
 --header 'Accept: application/json' \
 --header 'Content-Type: application/json' \
 --request GET "${opsMgrExtUrl}/api/public/v1.0/groups/${projectId}/controlledFeature?pretty=true" )

errorCode=$( printf "%s" "$output" | jq .errorCode )

if [[ "${errorCode}" == "null" ]]
then
    printf "%s\n" "$output" | jq
    exit 0
else
    printf "%s\n" "none"
    exit 1
fi
