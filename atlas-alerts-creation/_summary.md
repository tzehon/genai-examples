A MongoDB automation script streamlines the creation of Atlas database alerts by reading configurations from an Excel file and deploying them via the [MongoDB Atlas CLI](https://www.mongodb.com/docs/atlas/cli/current/). The tool parses alert definitions including thresholds, metrics, and notification settings, then generates JSON configurations and creates corresponding alerts in Atlas projects. It supports dry-run mode for testing, can target specific notification emails/roles, and includes deletion options to remove either automation-created alerts or all alerts in a project while preserving tracking through a local JSON file.

**Key Features:**
- Automates 20+ alert types covering replication, disk I/O, backups, CPU, and system metrics
- Parses natural language thresholds (e.g., "> 4000 for 2 minutes", "< 24h") into Atlas-compatible configurations
- Creates separate low/high priority alerts when different thresholds are specified
- Tracks automation-created alerts separately from Atlas defaults for safe selective deletion
- Generates audit logs and JSON files for all operations