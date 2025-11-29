A comprehensive Kubernetes deployment framework for MongoDB Ops Manager using MongoDB Controllers for Kubernetes (MCK). The project automates the setup of production-ready MongoDB infrastructure including Ops Manager with backup (oplog + blockstore), TLS encryption via cert-manager, LDAP authentication, and multi-cluster support using Istio service mesh. Originally evolved from a Docker-based setup, now focuses exclusively on Kubernetes with support for GKE, EKS, OpenShift, and local clusters.

Key capabilities:
- One-command deployment of Ops Manager + managed clusters via `_launch.bash`
- Automatic backup infrastructure with point-in-time recovery
- Multi-cluster deployments spanning separate Kubernetes clusters

Related: [MongoDB Controllers for Kubernetes](https://www.mongodb.com/docs/kubernetes/current/) | [ops-manager-alerts-creation](https://github.com/tzehon/research/tree/main/ops-manager-alerts-creation)
