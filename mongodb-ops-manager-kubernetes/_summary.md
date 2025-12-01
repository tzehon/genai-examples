MongoDB administrators can deploy production-ready [MongoDB Ops Manager](https://www.mongodb.com/docs/ops-manager/current/) on Kubernetes using this complete infrastructure setup built on [MongoDB Controllers for Kubernetes (MCK)](https://www.mongodb.com/docs/kubernetes/current/). The project automates deployment of Ops Manager 8.0.x with a 3-node application database, automated backup infrastructure (oplog + blockstore for point-in-time recovery), TLS encryption via cert-manager, LDAP integration, and external access configurations for both replica sets and sharded clusters. A single `_launch.bash` script orchestrates the entire stack, or administrators can use step-by-step scripts to deploy the MCK operator, Ops Manager, and managed MongoDB clusters independently.

**Key Features:**
- Complete backup infrastructure with configurable snapshot schedules and retention policies
- TLS/SSL automation using cert-manager with self-signed or custom CA options
- Split-horizon DNS for replica sets and LoadBalancer exposure for sharded cluster mongos
- LDAP integration for centralized authentication (Ops Manager + database users)
- Production-ready templates for both replica set and sharded cluster deployments
- Comprehensive cleanup utilities for redeployment and troubleshooting scenarios