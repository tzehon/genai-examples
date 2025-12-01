#!/bin/bash

# Resolve bin directory and add to PATH so scripts can find each other
_bindir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
PATH="${_bindir}:${PATH}"
source "${_bindir}/../scripts/init.conf"

conf=$( sed -e '/myNodeIp/d' ${deployconf} )
printf "%s\n" "${conf}" > ${deployconf}
eval nodes=( $( kubectl get node -o json |jq ".items[].status.addresses[0].address" ) )
myNodeIp=${nodes[0]}
printf "myNodeIp=${myNodeIp}" | tee -a ${deployconf}

source ${deployconf}

curlData=$( printf '{ "cidrBlock": "MYIP", "description": "my IP"}' | sed -e"s?MYIP?${myNodeIp}/1?g" )
output=$( curl $curlOpts --silent --user "${publicApiKey}:${privateApiKey}" --digest \
--header 'Accept: application/json' \
--header 'Content-Type: application/json' \
--request POST "${opsMgrExtUrl1}/api/public/v1.0/admin/whitelist?pretty=true" \
--data "${curlData}" )

printf "${output}"
