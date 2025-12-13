MongoDB Ops Manager can be deployed on Kubernetes using the MongoDB Controllers for Kubernetes (MCK) operator, providing a complete automated setup with TLS encryption via cert-manager, backup infrastructure with point-in-time recovery, and LDAP integration options. This educational project streamlines the deployment of Ops Manager 8.0.x with its application database (3-node replica set), automated backup stores (oplog + blockstore), and managed MongoDB clusters (both replica sets and sharded clusters) through a collection of bash scripts and YAML templates. The setup includes external access via split-horizon DNS or LoadBalancer services, with automatic certificate management and connection helpers for accessing deployed clusters.

**Key capabilities:**
- Automated full-stack deployment with `_launch.bash` script (MCK operator, cert-manager, Ops Manager, backup infrastructure)
- External connectivity with automatic TLS certificate regeneration for LoadBalancer-exposed mongos instances
- Helper scripts for retrieving API keys, connection strings, and establishing database connections (internal/external, with/without LDAP)
- Cleanup utilities for restarting failed deployments or tearing down environments

**Learn more:** [MongoDB Controllers for Kubernetes](https://www.mongodb.com/docs/kubernetes/current/) | [cert-manager](https://cert-manager.io/docs/)