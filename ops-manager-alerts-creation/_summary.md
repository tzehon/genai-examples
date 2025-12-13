A Python automation tool streamlines the deployment of [MongoDB Ops Manager](https://www.mongodb.com/products/ops-manager) alert configurations across multiple projects by reading threshold definitions from an Excel spreadsheet and creating alerts via the Ops Manager API. The script uses HTTP Digest authentication to generate JSON configurations for various alert types including replica set health, host metrics, disk partition monitoring, and Ops Manager-specific backup/agent alerts. It supports dry-run mode for previewing changes, tracks created alert IDs for selective cleanup, and includes utilities for discovering correct metric names by inspecting manually-created alerts through the API.

**Key capabilities:**
- Creates alerts from Excel configurations with low/high priority thresholds
- Supports 30+ alert types covering replication lag, CPU usage, disk IOPS, connection counts, and agent health
- Includes safe deletion options (automation-created only vs. all alerts)
- Handles SSL certificates and provides metric name discovery tools for troubleshooting
- Differs from Atlas automation by using direct API authentication instead of CLI and supporting Ops Manager-specific alert types