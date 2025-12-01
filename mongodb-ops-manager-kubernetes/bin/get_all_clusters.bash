#!/bin/bash

# Resolve bin directory and add to PATH so scripts can find each other
_bindir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
PATH="${_bindir}:${PATH}"
source "${_bindir}/../scripts/init.conf"

if [[ -e ${deployconf} ]]
then
    source ${deployconf}
else
    get_key.bash
    source ${deployconf}
fi

out=$( curl $curlOpts --silent --user "${publicKey}:${privateKey}" --digest \
 --header 'Accept: application/json' \
 --header 'Content-Type: application/json' \
 --request GET "${opsMgrExtUrl1}/api/public/v1.0/clusters?pretty=true" )

printf "%s" "$out" | jq '.results[]'
