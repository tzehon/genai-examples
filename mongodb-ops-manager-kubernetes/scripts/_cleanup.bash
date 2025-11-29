#!/bin/bash

# Cleanup script for MongoDB Ops Manager on Kubernetes
# Run this before redeploying with _launch.bash

d=$( dirname "$0" )
cd "${d}"
source init.conf 2>/dev/null || true

usage() {
    echo "Usage: $(basename $0) [-a] [-k] [-f] [-c] [-h]"
    echo "  -a  Full cleanup: Kubernetes resources + local files (prompts for confirmation)"
    echo "  -k  Kubernetes only: Delete namespace and all K8s resources"
    echo "  -f  Files only: Delete local generated files (certs, manifests, configs)"
    echo "  -c  Cluster delete: Delete the GKE cluster(s) entirely (prompts for confirmation)"
    echo "  -h  Show this help"
    echo ""
    echo "Examples:"
    echo "  $(basename $0) -f    # Clean local files before redeploy (keeps K8s running)"
    echo "  $(basename $0) -k    # Delete K8s resources (keeps local files)"
    echo "  $(basename $0) -a    # Full cleanup for fresh start"
    echo "  $(basename $0) -c    # Delete GKE cluster(s) completely"
    exit 1
}

delete_cluster() {
    echo "=== Deleting GKE cluster(s) ==="

    # Check if gcloud is available
    if ! command -v gcloud &> /dev/null; then
        echo "ERROR: gcloud CLI not found"
        exit 1
    fi

    # Use 0_make_k8s.bash -d which handles cluster deletion
    if [[ -x "./0_make_k8s.bash" ]]; then
        echo "Running: ./0_make_k8s.bash -d"
        ./0_make_k8s.bash -d
    else
        echo "ERROR: 0_make_k8s.bash not found or not executable"
        exit 1
    fi
}

cleanup_k8s() {
    echo "=== Cleaning up Kubernetes resources ==="

    # Check if kubectl is available
    if ! command -v kubectl &> /dev/null; then
        echo "kubectl not found, skipping K8s cleanup"
        return
    fi

    # Check if cluster is accessible
    if ! kubectl cluster-info &> /dev/null; then
        echo "Cannot connect to Kubernetes cluster, skipping K8s cleanup"
        return
    fi

    echo "Deleting namespace: ${namespace:-mongodb}"
    kubectl delete namespace ${namespace:-mongodb} --ignore-not-found --timeout=120s

    echo "Kubernetes cleanup complete"
}

cleanup_files() {
    echo "=== Cleaning up local generated files ==="

    # Generated certificates
    if ls certs/certs_*.yaml 1> /dev/null 2>&1; then
        echo "Removing generated certificate files..."
        rm -f certs/certs_*.yaml
    fi

    # Generated manifests
    echo "Removing generated manifests..."
    rm -f mdb_*.yaml
    rm -f mdbom_*.yaml
    rm -f mdbuser_*.yaml

    # Bin directory copy of init.conf
    rm -f bin/init.conf

    # Old deploy configs (keep only today's if exists)
    today=$(date "+%F")
    echo "Removing old deploy config files (keeping today's: deploy_${today}.conf)..."
    for f in deploy_*.conf; do
        if [[ -f "$f" && "$f" != "deploy_${today}.conf" ]]; then
            echo "  Removing: $f"
            rm -f "$f"
        fi
    done

    echo "Local file cleanup complete"
}

# Parse options
while getopts 'akfch' opt; do
    case "$opt" in
        a) MODE="all" ;;
        k) MODE="k8s" ;;
        f) MODE="files" ;;
        c) MODE="cluster" ;;
        h|?) usage ;;
    esac
done

if [[ -z "$MODE" ]]; then
    usage
fi

case "$MODE" in
    all)
        echo "WARNING: This will delete all Kubernetes resources and local generated files!"
        read -p "Are you sure? (y/N) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            cleanup_k8s
            cleanup_files
            echo ""
            echo "=== Full cleanup complete ==="
            echo "You can now run ./_launch.bash for a fresh deployment"
        else
            echo "Aborted"
            exit 1
        fi
        ;;
    k8s)
        cleanup_k8s
        ;;
    files)
        cleanup_files
        ;;
    cluster)
        echo "WARNING: This will DELETE the GKE cluster(s) entirely!"
        echo "Cluster: ${MDB_CENTRAL_C:-mdb-central} in ${MDB_CENTRAL_REGION:-us-west1}"
        read -p "Are you sure? (y/N) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            delete_cluster
        else
            echo "Aborted"
            exit 1
        fi
        ;;
esac
