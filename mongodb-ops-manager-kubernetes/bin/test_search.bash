#!/bin/bash

# test_search.bash - Verify MongoDB Search functionality
# This script tests that MongoDB Search nodes are working correctly by:
# 1. Inserting test documents
# 2. Creating a search index
# 3. Waiting for the index to become ready (eventual consistency)
# 4. Running a $search query
# 5. Verifying results
# 6. Cleaning up test data

# Resolve bin directory and add to PATH
_bindir=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
PATH="${_bindir}:${PATH}"
source "${_bindir}/../scripts/init.conf"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values
keepData=false
timeout=180  # 3 minutes for index to become ready
testDb="search_test"
testCollection="movies"
indexName="test_search_index"

usage() {
    echo "Usage: $(basename $0) [-n clusterName] [-k] [-t timeout]"
    echo "       -n clusterName  Name of the MongoDB cluster to test"
    echo "       -k              Keep test data after completion (don't cleanup)"
    echo "       -t timeout      Timeout in seconds for index to become ready (default: 180)"
    exit 1
}

while getopts 'n:kt:h' opt
do
  case "$opt" in
    n) name="$OPTARG" ;;
    k) keepData=true ;;
    t) timeout="$OPTARG" ;;
    ?|h) usage ;;
  esac
done
shift "$(($OPTIND -1))"

name=${name:-myproject1-myreplicaset}

echo ""
echo "Testing MongoDB Search on ${name}..."
echo ""

# Step 1: Get connection string
echo "[1/5] Connecting to cluster..."
cs=$( get_connection_string.bash -n "${name}" 2>/dev/null )
if [[ -z "$cs" || "$cs" == *"Error"* ]]
then
    echo -e "      ${RED}FAILED${NC} - Could not get connection string"
    echo "      Check that cluster '${name}' exists: kubectl -n ${namespace} get mongodb"
    exit 1
fi
fcs=${cs#*: }
echo "      \$ mongosh \"${fcs%% *}...\""
echo -e "      ${GREEN}OK${NC} - Connected"
echo ""

# Step 2: Insert test documents
echo "[2/5] Inserting test documents..."
insertCmd="db.getSiblingDB('${testDb}').${testCollection}.insertMany([
  { title: 'The Matrix', year: 1999, genre: 'sci-fi', plot: 'A computer hacker learns about the true nature of reality' },
  { title: 'Inception', year: 2010, genre: 'sci-fi', plot: 'A thief who steals corporate secrets through dream-sharing technology' },
  { title: 'The Godfather', year: 1972, genre: 'drama', plot: 'The aging patriarch of an organized crime dynasty' }
])"

echo "      \$ db.getSiblingDB('${testDb}').${testCollection}.insertMany([...])"
result=$( eval "mongosh ${fcs} --quiet --eval \"${insertCmd}\"" 2>&1 )
if [[ "$result" == *"acknowledged"* && "$result" == *"true"* ]]
then
    echo "      $result" | head -5
    echo -e "      ${GREEN}OK${NC} - Inserted 3 test documents"
else
    echo -e "      ${RED}FAILED${NC} - Could not insert documents"
    echo "      $result"
    exit 1
fi
echo ""

# Step 3: Create search index
echo "[3/5] Creating search index..."
createIndexCmd="db.getSiblingDB('${testDb}').${testCollection}.createSearchIndex('${indexName}', { mappings: { dynamic: true } })"
echo "      \$ db.getSiblingDB('${testDb}').${testCollection}.createSearchIndex('${indexName}', { mappings: { dynamic: true } })"

result=$( eval "mongosh ${fcs} --quiet --eval \"${createIndexCmd}\"" 2>&1 )
if [[ "$result" == *"${indexName}"* || "$result" == *"already exists"* ]]
then
    echo "      '${indexName}'"
    echo -e "      ${GREEN}OK${NC} - Search index created (or already exists)"
else
    echo -e "      ${RED}FAILED${NC} - Could not create search index"
    echo "      $result"
    # Cleanup and exit
    if [[ ${keepData} == false ]]; then
        eval "mongosh ${fcs} --quiet --eval \"db.getSiblingDB('${testDb}').dropDatabase()\"" > /dev/null 2>&1
    fi
    exit 1
fi
echo ""

# Step 4: Wait for index to be ready
echo "[4/5] Waiting for index to be ready..."
getIndexCmd="db.getSiblingDB('${testDb}').${testCollection}.getSearchIndexes()"
echo "      \$ db.getSiblingDB('${testDb}').${testCollection}.getSearchIndexes()"

elapsed=0
interval=10
indexReady=false

while [ $elapsed -lt $timeout ]
do
    result=$( eval "mongosh ${fcs} --quiet --eval \"${getIndexCmd}\"" 2>&1 )

    # Check if index exists (on-prem search doesn't have status/queryable fields like Atlas)
    # For Atlas Search: check for "READY" and "queryable: true"
    # For on-prem Search: check for index name in response
    if [[ "$result" == *"READY"* && "$result" == *"queryable: true"* ]]
    then
        echo "      $result" | grep -E "(name|status|queryable)" | head -5
        echo -e "      Status: ${GREEN}READY${NC} (${elapsed}s elapsed)"
        indexReady=true
        break
    elif [[ "$result" == *"${indexName}"* && "$result" == *"latestDefinition"* ]]
    then
        # On-prem MongoDB Search format - index exists and has definition
        echo "      $result" | grep -E "(name|type)" | head -3
        echo -e "      Status: ${GREEN}INDEX EXISTS${NC} (${elapsed}s elapsed)"
        indexReady=true
        break
    else
        status=$( echo "$result" | grep -o "status: '[^']*'" | head -1 || echo "status: 'PENDING'" )
        echo "      $status (${elapsed}s elapsed, waiting...)"
    fi

    sleep $interval
    elapsed=$((elapsed + interval))
done

if [[ ${indexReady} == false ]]
then
    echo -e "      ${RED}TIMEOUT${NC} after ${timeout}s"
    echo "      Index did not reach READY state"
    echo ""
    echo "      Check search pod logs:"
    echo "      kubectl -n ${namespace} logs ${name}-search-0"
    # Cleanup and exit
    if [[ ${keepData} == false ]]; then
        eval "mongosh ${fcs} --quiet --eval \"db.getSiblingDB('${testDb}').dropDatabase()\"" > /dev/null 2>&1
    fi
    exit 1
fi
echo ""

# Step 5: Run search query
echo "[5/5] Running \$search query..."
searchCmd="db.getSiblingDB('${testDb}').${testCollection}.aggregate([
  { \\\$search: { index: '${indexName}', text: { query: 'matrix', path: 'title' } } }
]).toArray()"

echo "      \$ db.getSiblingDB('${testDb}').${testCollection}.aggregate(["
echo "          { \$search: { index: '${indexName}', text: { query: 'matrix', path: 'title' } } }"
echo "        ])"

result=$( eval "mongosh ${fcs} --quiet --eval \"${searchCmd}\"" 2>&1 )

if [[ "$result" == *"The Matrix"* ]]
then
    echo "      $result" | head -10
    echo -e "      ${GREEN}OK${NC} - Found 'The Matrix' document"
else
    echo -e "      ${RED}FAILED${NC} - Search query did not return expected results"
    echo "      $result"
    # Cleanup and exit
    if [[ ${keepData} == false ]]; then
        eval "mongosh ${fcs} --quiet --eval \"db.getSiblingDB('${testDb}').dropDatabase()\"" > /dev/null 2>&1
    fi
    exit 1
fi
echo ""

# Summary
echo "=============================================="
echo -e "${GREEN}MongoDB Search is working correctly!${NC}"
echo "=============================================="
echo ""

# Cleanup
if [[ ${keepData} == false ]]
then
    echo "[Cleanup] Removing test data..."
    cleanupCmd="db.getSiblingDB('${testDb}').dropDatabase()"
    echo "      \$ db.getSiblingDB('${testDb}').dropDatabase()"
    result=$( eval "mongosh ${fcs} --quiet --eval \"${cleanupCmd}\"" 2>&1 )
    echo "      $result"
    echo -e "      ${GREEN}OK${NC} - Test data removed"
else
    echo "[Cleanup] Skipping cleanup (-k flag specified)"
    echo "      Test data remains in database: ${testDb}"
fi
echo ""
echo "Done."
