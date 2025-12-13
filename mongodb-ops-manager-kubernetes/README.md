# MongoDB Ops Manager on Kubernetes

> **Note:** This project is intended for **getting started, learning, and demonstration purposes only**. It is not production-ready. The scripts lack comprehensive error handling, input validation, and security hardening required for production environments.

Deploy MongoDB Ops Manager and managed MongoDB clusters on Kubernetes using MongoDB Controllers for Kubernetes (MCK). This project provides a quick-start setup including TLS encryption, backup infrastructure, LDAP integration, and external access options.

## Key Features

- **Ops Manager 8.0.x** with Application Database (3-node replica set)
- **Automated Backup** with oplog + blockstore infrastructure for point-in-time recovery
- **TLS/SSL Encryption** via cert-manager with self-signed or custom CA
- **LDAP Integration** for both Ops Manager and database user authentication
- **External Access** via split-horizon DNS or LoadBalancer/NodePort services
- **ReplicaSet & Sharded Clusters** for demonstration and testing

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
| Kubernetes | 1.16+ | Tested on GKE, EKS, OpenShift |
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
| Ops Manager | 8.0.13 | [Release Notes](https://www.mongodb.com/docs/ops-manager/current/release-notes/application/) |
| MongoDB Enterprise | 8.0.4-ent | [Compatibility](https://www.mongodb.com/docs/ops-manager/current/reference/mongodb-compatibility/) |
| cert-manager | v1.16.2 | [Docs](https://cert-manager.io/docs/) |

## Evolution & Lessons Learned

This project evolved through several major iterations:

1. **MEKO to MCK Migration** - Migrated from the deprecated MongoDB Enterprise Kubernetes Operator (MEKO) to MongoDB Controllers for Kubernetes (MCK), the new standardized operator using Helm-based installation.

2. **Docker to Kubernetes-Only** - Removed Docker Compose setup to focus exclusively on Kubernetes deployments for production parity.

3. **cert-manager Integration** - Replaced manual cfssl certificate generation with Venafi Jetstack cert-manager for automated TLS lifecycle management.

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
