# MongoDB Ops Manager on Kubernetes

> **Note:** This project is designed for learning, demonstration, and development purposes. For production deployments, consult the [official MongoDB documentation](https://www.mongodb.com/docs/kubernetes/current/) for recommended architectures, security practices, and operational procedures.

Deploy MongoDB Ops Manager and managed MongoDB clusters on Kubernetes using MongoDB Controllers for Kubernetes (MCK). This project provides a quick-start setup including TLS encryption, backup infrastructure, LDAP integration, and external access options.

## Key Features

- **Ops Manager 8.0.x** with Application Database (3-node replica set)
- **Automated Backup** with oplog + blockstore infrastructure for point-in-time recovery
- **TLS/SSL Encryption** via cert-manager with self-signed or custom CA
- **LDAP Integration** for both Ops Manager and database user authentication
- **External Access** via split-horizon DNS or LoadBalancer/NodePort services
- **ReplicaSet & Sharded Clusters** for demonstration and testing
- **MongoDB Search (Preview)** - Full-text and vector search via `mongot` pods

## Architecture

```
                         Kubernetes Cluster
+------------------------------------------------------------------+
|                                                                  |
|  +------------------------------------------------------------+  |
|  |  MongoDB Controllers (MCK) - Helm deployed                 |  |
|  +------------------------------------------------------------+  |
|                              |                                   |
|         +--------------------+--------------------+              |
|         v                    v                    v              |
|  +-------------+      +-------------+      +-------------+       |
|  | Ops Manager |      | Backup      |      | Production  |       |
|  |-------------|      |-------------|      |-------------|       |
|  | OM Pod:8443 |      | Oplog (3)   |      | ReplicaSet  |       |
|  | AppDB (3)   |      | Blockstore  |      | Sharded     |       |
|  +-------------+      +-------------+      +-------------+       |
|                                                                  |
|  +------------------------------------------------------------+  |
|  |  cert-manager - TLS lifecycle management                   |  |
|  +------------------------------------------------------------+  |
|                                                                  |
|  +-------------+  (Optional)                                     |
|  | OpenLDAP    |  Enterprise auth for OM + DB users              |
|  +-------------+                                                 |
|                                                                  |
+------------------------------------------------------------------+
```

## Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| Kubernetes | 1.16+ | Tested on GKE |
| kubectl | Latest | Kubernetes CLI |
| Helm | 3.x | For MCK operator installation |
| gcloud | Latest | For GKE cluster creation |
| cfssl (optional) | Latest | For custom CA generation |

### Resource Requirements

| CPU | Memory | Disk |
|-----|--------|------|
| 48-64 cores | 192-256 GB | 2-5 TB |

## Quick Start

```bash
# 1. Clone and configure
cd mongodb-ops-manager-kubernetes/scripts
cp sample_init.conf init.conf
vi init.conf  # Set your credentials and preferences

# 2. Create K8s cluster (optional - for GKE)
./0_make_k8s.bash

# 3. Deploy everything
./_launch.bash

# 4. Get Ops Manager URL
grep opsMgrExtUrl init.conf

# 5. Get API Key (for creating alerts, API access, etc.)
bin/get_key.bash
# Or from K8s secret:
kubectl get secret mongodb-opsmanager-admin-key -n mongodb \
  -o jsonpath='{.data.publicKey}' | base64 -d && echo
kubectl get secret mongodb-opsmanager-admin-key -n mongodb \
  -o jsonpath='{.data.privateKey}' | base64 -d && echo
```

## Installation

### Step 1: Configure Environment

Copy and customize the configuration file:

```bash
cp scripts/sample_init.conf scripts/init.conf
```

Key settings to configure:

| Setting | Description | Default |
|---------|-------------|---------|
| `user` | Ops Manager admin email | - |
| `password` | Ops Manager admin password | - |
| `namespace` | K8s namespace for deployment | `mongodb` |
| `serviceType` | `LoadBalancer` or `NodePort` | `LoadBalancer` |
| `tls` | Enable TLS encryption | `true` |
| `omBackup` | Enable backup infrastructure | `true` |
| `clusterDomain` | External domain name | `mdb.com` |

### Step 2: Create Kubernetes Cluster

For GKE clusters:

```bash
cd scripts
./0_make_k8s.bash
```

This creates a GKE cluster with appropriate node pools. For other providers (EKS, OpenShift), ensure your cluster meets the resource requirements above.

### Step 3: Deploy the Stack

**Option A: Full automated deployment**
```bash
./_launch.bash
```

**Option B: Step-by-step deployment**
```bash
# Deploy MCK operator + cert-manager
./deploy_Operator.bash

# Deploy Ops Manager + AppDB
./deploy_OM.bash

# Deploy production clusters
./deploy_Cluster.bash -n myreplicaset -v 8.0.4-ent
```

### Step 4: Access Ops Manager

```bash
# Get external URL
kubectl get svc opsmanager-svc-ext -n mongodb

# Or from init.conf (after deployment)
grep opsMgrExtUrl init.conf
```

Access via browser: `https://<EXTERNAL-IP>:8443`
- Login with credentials from `init.conf`
- Accept the self-signed certificate warning

## Directory Structure

```
mongodb-ops-manager-kubernetes/
├── scripts/                    # Core deployment scripts
│   ├── sample_init.conf        # Configuration template
│   ├── 0_make_k8s.bash         # GKE cluster creation
│   ├── deploy_Operator.bash    # MCK + cert-manager deployment
│   ├── deploy_OM.bash          # Ops Manager deployment
│   ├── deploy_Cluster.bash     # MongoDB cluster deployment
│   ├── _launch.bash            # Full deployment orchestration
│   ├── _cleanup.bash           # Cleanup utilities
│   └── crds.yaml               # Custom Resource Definitions
├── templates/                  # YAML templates
│   ├── mdbom_template.yaml     # Ops Manager resource
│   ├── mdb_template_rs.yaml    # ReplicaSet cluster
│   ├── mdb_template_sh.yaml    # Sharded cluster
│   ├── mdbuser_template_*.yaml # Database users
│   ├── openldap.yaml           # LDAP server
│   └── svc_expose_*.yaml       # Service exposure
├── certs/                      # Certificate management
│   ├── cert-manager.yaml       # cert-manager deployment
│   ├── generate_ca.bash        # CA generation
│   ├── make_*_certs.bash       # Certificate scripts
│   └── cert_template.yaml      # Certificate template
├── bin/                        # Utility scripts
│   ├── deploy_org.bash         # Organization setup
│   ├── deploy_ldap.bash        # LDAP deployment
│   ├── get_*.bash              # Query helpers
│   ├── create_*.bash           # Resource creation
│   └── connect_*.bash          # Connection helpers
├── helm/                       # Helm charts
│   └── enterprise-database/    # MongoDB Enterprise chart
└── misc/                       # Diagnostic utilities
```

## Configuration Options

### TLS Configuration

TLS is enabled by default using cert-manager:

```bash
# In init.conf
tls="true"
tlsMode="requireTLS"  # Options: requireTLS, preferTLS, allowTLS
```

To use a custom CA:
1. Place your CA files in `certs/`
2. Run `certs/make_cert_issuer.bash`

### External Access

**Split-Horizon (ReplicaSet)**
```bash
# Configures internal + external DNS names
./deploy_Cluster.bash -n myreplicaset -e horizon
```

**LoadBalancer (Sharded)**
```bash
# Exposes mongos via LoadBalancer with automatic TLS cert update
./deploy_Cluster.bash -n mysharded -s 2 -r 2
```

The deployment script automatically:
- Creates LoadBalancer services for each mongos
- Waits for external IPs to be assigned
- Regenerates mongos TLS certificates with external DNS names
- Enables external connections without manual certificate steps

### LDAP Integration

```bash
# Deploy OpenLDAP server
bin/deploy_ldap.bash

# Pre-configured users:
# - dbAdmin, User01, User02 (password: Mongodb1)
# - Groups: dbadmins, dbusers, readers, managers
```

### MongoDB Search (Preview)

> **Note:** MongoDB Search is currently a Preview feature. The feature and documentation may change during the Preview period.

Deploy MongoDB Search nodes (`mongot`) to enable full-text search and vector search capabilities on ReplicaSets.

**Requirements:**
- MongoDB 8.2+ Enterprise Edition
- Ops Manager 8.0.14+ (required for `searchCoordinator` role support)
- ReplicaSet only (sharded clusters not supported)
- MCK Operator 1.6+

**Deploy with Search:**
```bash
# Deploy ReplicaSet with search nodes
./deploy_Cluster.bash -n myreplicaset -v 8.2.0-ent --search

# Or add to existing deployment command
./deploy_Cluster.bash -n myreplicaset -v 8.2.0-ent -e horizon --search
```

**Verify Search is Working:**
```bash
# Run the automated test script
bin/test_search.bash -n myproject1-myreplicaset

# Keep test data for manual inspection
bin/test_search.bash -n myproject1-myreplicaset -k
```

The test script:
1. Inserts test documents
2. Creates a search index
3. Waits for index to become ready (handles eventual consistency)
4. Runs a `$search` query
5. Verifies results
6. Cleans up test data

**Example output:**
```
Testing MongoDB Search on myproject1-myreplicaset...

[1/5] Connecting to cluster...
      $ mongosh "mongodb://..."
      OK - Connected

[2/5] Inserting test documents...
      $ db.getSiblingDB('search_test').movies.insertMany([...])
      OK - Inserted 3 test documents

[3/5] Creating search index...
      $ db.getSiblingDB('search_test').movies.createSearchIndex('test_search_index', ...)
      OK - Search index created

[4/5] Waiting for index to be ready...
      $ db.getSiblingDB('search_test').movies.getSearchIndexes()
      status: 'BUILDING' (10s elapsed, waiting...)
      status: 'READY' (25s elapsed)

[5/5] Running $search query...
      $ db.movies.aggregate([{ $search: { text: { query: 'matrix', path: ... } } }])
      OK - Found 'The Matrix' document

==============================================
MongoDB Search is working correctly!
==============================================
```

**Monitoring Search Nodes:**
```bash
# Check MongoDBSearch resource status
kubectl -n mongodb get mdbs

# Check search pod status
kubectl -n mongodb get pods | grep search

# View search pod logs
kubectl -n mongodb logs <cluster-name>-search-0

# Prometheus metrics (enabled by default on port 9946)
kubectl -n mongodb port-forward <cluster-name>-search-0 9946:9946
curl http://localhost:9946/metrics
```

**Resources created:**
| Resource | Purpose |
|----------|---------|
| `MongoDBSearch` CR | Manages mongot StatefulSet |
| `<cluster>-search-0` pod | mongot process for indexing and queries |
| `<cluster>-search-sync-source` user | User with `searchCoordinator` role |
| `<cluster>-search-tls` secret | TLS certificate for mongot |

## Backup Infrastructure

Automatically deployed with `_launch.bash`:

| Component | Purpose | Size |
|-----------|---------|------|
| **Oplog Store** | Continuous/point-in-time recovery | 3-node RS |
| **Blockstore** | Snapshot storage | 3-node RS |
| **Backup Daemon** | Runs in OM pod | 1 instance |

Default schedule:
- Snapshots: Every 24 hours
- Retention: 2 days (snapshots), 2 weeks (weekly), 1 month (monthly)
- Point-in-time: 1 day window

## Common Operations

### Retrieve API Keys

```bash
# From config file (after deployment)
cat scripts/deploy_*.conf | grep -E "publicKey|privateKey"

# From K8s secret
kubectl get secret mongodb-opsmanager-admin-key -n mongodb \
  -o jsonpath='{.data.publicKey}' | base64 -d

# Using helper script
bin/get_key.bash
```

### Connect to Clusters

```bash
# List available clusters
kubectl get mongodb -n mongodb

# Connect to ReplicaSet (external - from outside K8s)
bin/connect_external.bash -n myproject1-myreplicaset

# Connect to Sharded Cluster (connects to mongos)
bin/connect_external.bash -n myproject2-mysharded

# Get connection string only (without opening shell)
bin/get_connection_string.bash -n myproject1-myreplicaset

# Connect with LDAP authentication
bin/connect_external.bash -n myproject1-myreplicaset -l

# Connect from within K8s (pod-to-pod)
bin/connect_from_pod.bash -n myproject1-myreplicaset

# Get internal connection string
bin/get_connection_string.bash -n myproject1-myreplicaset -i
```

The connection scripts automatically:
- Extract credentials from Kubernetes secrets
- Download TLS certificates (CA + client cert) to `certs/`
- Build the full connection string with TLS parameters

### Cleanup

Use `_cleanup.bash` to clean up resources before redeploying or to tear down the environment:

```bash
# Restart deployment (recommended before re-running _launch.bash)
# Uninstalls Helm release, deletes namespace, waits for cleanup
./_cleanup.bash -k

# Clean local files only (certs, manifests, configs)
./_cleanup.bash -f

# Full cleanup (Kubernetes resources + local files)
./_cleanup.bash -a

# Delete GKE cluster(s) entirely
./_cleanup.bash -c
```

| Option | Description |
|--------|-------------|
| `-k` | **Kubernetes only**: Uninstalls MCK Helm release, deletes namespace, waits for termination |
| `-f` | **Files only**: Removes generated certs, manifests, and config files |
| `-a` | **All**: Full cleanup of both K8s resources and local files (prompts for confirmation) |
| `-c` | **Cluster**: Deletes the GKE cluster(s) entirely (prompts for confirmation) |

**Typical workflow to restart a failed deployment:**
```bash
./_cleanup.bash -k   # Clean up Kubernetes resources
./_launch.bash       # Re-run the deployment
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Pods stuck in `Pending` | Check node resources: `kubectl describe nodes` |
| Ops Manager not ready | Wait for AppDB: `kubectl get mongodb -n mongodb -w` |
| TLS certificate errors | Regenerate certs: `certs/generate_ca.bash && certs/make_OM_certs.bash` |
| External access not working | Check service type: `kubectl get svc -n mongodb` |
| LDAP auth failing | Verify LDAP pod: `kubectl get pods -n mongodb | grep ldap` |

### Diagnostic Commands

```bash
# Check MCK operator
kubectl get deployments mongodb-kubernetes-operator -n mongodb
kubectl logs -l app.kubernetes.io/name=mongodb-kubernetes -n mongodb

# Check Ops Manager status
kubectl get opsmanagers -n mongodb
kubectl describe opsmanager opsmanager -n mongodb

# Check MongoDB clusters
kubectl get mongodb -n mongodb
kubectl describe mongodb <cluster-name> -n mongodb

# Collect diagnostic data
misc/mdb_operator_diagnostic_data.sh
```

## Versions

| Component | Version | Documentation |
|-----------|---------|---------------|
| MongoDB Controllers for Kubernetes (MCK) | 1.6.0 | [Docs](https://www.mongodb.com/docs/kubernetes/current/) |
| Ops Manager | 8.0.14 | [Release Notes](https://www.mongodb.com/docs/ops-manager/current/release-notes/application/) |
| MongoDB Enterprise | 8.2.0-ent | [Compatibility](https://www.mongodb.com/docs/ops-manager/current/reference/mongodb-compatibility/) |
| cert-manager | v1.16.2 | [Docs](https://cert-manager.io/docs/) |
| MongoDB Search (Preview) | 0.55.0 | [Docs](https://www.mongodb.com/docs/kubernetes/current/fts-vs-deployment/) |

## Evolution & Lessons Learned

This project evolved through several major iterations:

1. **MEKO to MCK Migration** - Migrated from the deprecated MongoDB Enterprise Kubernetes Operator (MEKO) to MongoDB Controllers for Kubernetes (MCK), the new standardized operator using Helm-based installation.

2. **Docker to Kubernetes-Only** - Removed Docker Compose setup to focus exclusively on Kubernetes deployments for production parity.

3. **cert-manager Integration** - Replaced manual cfssl certificate generation with cert-manager for automated TLS lifecycle management.

4. **External Access Improvements** - Implemented split-horizon DNS for ReplicaSets and LoadBalancer exposure for sharded cluster mongos instances.

## Related Projects

Other MongoDB projects in this research repository:

| Project | Description |
|---------|-------------|
| [ops-manager-alerts-creation](../ops-manager-alerts-creation/) | Automate Ops Manager alert creation from Excel configs |
| [atlas-alerts-creation](../atlas-alerts-creation/) | Automate MongoDB Atlas alert deployment |
| [mongodb-failover-tester](../mongodb-failover-tester/) | Test MongoDB driver failover resilience |

## References

- [MongoDB Controllers for Kubernetes Documentation](https://www.mongodb.com/docs/kubernetes/current/)
- [MongoDB Ops Manager Documentation](https://www.mongodb.com/docs/ops-manager/current/)
- [cert-manager Documentation](https://cert-manager.io/docs/)
- [Helm Charts Repository](https://github.com/mongodb/helm-charts)
- [MongoDB Kubernetes Operator GitHub](https://github.com/mongodb/mongodb-kubernetes)
