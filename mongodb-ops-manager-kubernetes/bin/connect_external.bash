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
      printf "%s\n" "Usage: $(basename $0) [-n clusterName] [-l] "
      printf "%s\n" "       use -n clusterName"
      printf "%s\n" "       use -l for LDAP connection string versus SCRAM"
      exit 1
      ;;
  esac
done
shift "$(($OPTIND -1))"

mdbKind="MongoDB"

name=${name:-myproject1-myreplicaset}

cs=$( get_connection_string.bash -n "${name}" $ldap )
fcs=${cs#*: }
printf "\n%s\n\n" "Connection String: ${fcs}"
eval "mongosh ${fcs}"
