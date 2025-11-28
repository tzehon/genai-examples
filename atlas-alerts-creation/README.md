# MongoDB Atlas Alert Automation

Automation script to create MongoDB Atlas alerts from an Excel configuration file using the Atlas CLI.

**IMPORTANT: These are AUTOMATED ALERTS - NOT default Atlas alerts.**

## Why This Exists

MongoDB provides [recommended alert configurations](https://www.mongodb.com/docs/atlas/architecture/current/monitoring-alerts/#recommended-atlas-alert-configurations) to help teams monitor their Atlas deployments effectively. However, implementing these recommendations manually requires cross-referencing multiple documentation sources:

1. Review the [recommended alert configurations](https://www.mongodb.com/docs/atlas/architecture/current/monitoring-alerts/#recommended-atlas-alert-configurations) to understand what to monitor
2. Look up the [alert conditions reference](https://www.mongodb.com/docs/atlas/reference/alert-conditions/#host-alerts) to map each recommendation to the correct category, condition, and metric
3. Follow the [configure an alert guide](https://www.mongodb.com/docs/atlas/configure-alerts/#configure-an-alert) to actually create each alert in the Atlas UI
4. Set the correct threshold values and notification preferences
5. Repeat this process for each alert (20+ configurations)

For a single project, this can take significant time. For organizations managing multiple Atlas projects, the manual approach becomes a bottleneck during onboarding and increases the risk of misconfiguration.

This tool automates the entire process: define your alert configurations once in a spreadsheet, then deploy them consistently across any number of projects in seconds.

The included `atlas_alert_configurations.xlsx` spreadsheet was generated using an LLM to extract and structure the recommended alerts from the MongoDB documentation, saving additional manual effort.

## Prerequisites

- Python 3.8+
- MongoDB Atlas CLI installed and configured
- Atlas API Key or Service Account with Project Owner role
- Excel file `atlas_alert_configurations.xlsx` with alert definitions

## Installation

### Install MongoDB Atlas CLI

**macOS:**
```bash
brew install mongodb-atlas-cli
```

**Linux (Debian/Ubuntu):**
```bash
# Add MongoDB GPG key
curl -fsSL https://pgp.mongodb.com/server-7.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor

# Add repository
echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

# Install
sudo apt update && sudo apt install mongodb-atlas-cli
```

**Direct Download:**
https://www.mongodb.com/try/download/atlascli

### Configure Atlas CLI Authentication

Run the interactive login:
```bash
atlas auth login
```

You'll be prompted to select an authentication type:
- **UserAccount** - Best for getting started (opens browser)
- **ServiceAccount** - Best for automation
- **APIKeys** - For existing automations

**Verify authentication:**
```bash
atlas auth whoami
atlas projects list
```

### Install Python Dependencies

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Note: The wrapper script (`run_alerts.sh`) will use the existing `.venv` if present, or create one if not.

## Usage

### Basic Usage

```bash
./run_alerts.sh --project-id YOUR_PROJECT_ID
```

### Dry Run (Generate JSON Only)

Generate JSON files without creating alerts in Atlas:

```bash
./run_alerts.sh --project-id YOUR_PROJECT_ID --dry-run
```

### Custom Notification Email

```bash
./run_alerts.sh --project-id YOUR_PROJECT_ID --notification-email alerts@yourcompany.com
```

### Custom Excel File Location

```bash
./run_alerts.sh --project-id YOUR_PROJECT_ID --excel-file /path/to/alerts.xlsx
```

### Delete Automation-Created Alerts Only

```bash
./run_alerts.sh --project-id YOUR_PROJECT_ID --delete-existing
```

Deletes only alerts created by this automation (tracked in `.automation_alert_ids.json`). Default Atlas alerts are preserved. Does not create new alerts.

### Delete ALL Alerts

```bash
./run_alerts.sh --project-id YOUR_PROJECT_ID --delete-all
```

Deletes ALL alerts including default Atlas alerts. You'll need to type `delete all` to confirm. Does not create new alerts.

### All Options

```bash
./run_alerts.sh \
  --project-id YOUR_PROJECT_ID \
  --excel-file custom_alerts.xlsx \
  --output-dir ./my-alerts \
  --notification-email alerts@company.com \
  --notification-roles GROUP_OWNER,GROUP_DATA_ACCESS_ADMIN \
  --delete-existing \
  --dry-run
```

## Command Line Arguments

| Argument | Required | Default | Description |
|----------|----------|---------|-------------|
| `--project-id` | Yes | - | MongoDB Atlas Project ID |
| `--dry-run` | No | false | Generate JSON files but don't create alerts |
| `--excel-file` | No | `atlas_alert_configurations.xlsx` | Path to Excel configuration file |
| `--output-dir` | No | `./alerts` | Directory for generated JSON files |
| `--notification-email` | No | - | Email address for alert notifications |
| `--notification-roles` | No | `GROUP_OWNER` | Comma-separated notification roles |
| `--delete-existing` | No | false | Delete automation-created alerts only, then exit |
| `--delete-all` | No | false | Delete ALL alerts (including defaults), then exit |
| `--log-dir` | No | `./logs` | Directory for log files |

## Alert Configuration Mapping

| Alert Name | Atlas Event Type | Metric Name |
|------------|------------------|-------------|
| Oplog Window | REPLICATION_OPLOG_WINDOW_RUNNING_OUT | - |
| Number of elections in last hour | PRIMARY_ELECTED | - |
| Disk read IOPS on Data Partition | OUTSIDE_METRIC_THRESHOLD | DISK_PARTITION_READ_IOPS_DATA |
| Disk write IOPS on Data Partition | OUTSIDE_METRIC_THRESHOLD | DISK_PARTITION_WRITE_IOPS_DATA |
| Disk read latency on Data Partition | OUTSIDE_METRIC_THRESHOLD | DISK_PARTITION_READ_LATENCY_DATA |
| Disk write latency on Data Partition | OUTSIDE_METRIC_THRESHOLD | DISK_PARTITION_WRITE_LATENCY_DATA |
| Swap Usage | OUTSIDE_METRIC_THRESHOLD | SWAP_USAGE_USED |
| Host is Down | HOST_DOWN | - |
| Replica set has no primary | NO_PRIMARY | - |
| Page Faults | OUTSIDE_METRIC_THRESHOLD | EXTRA_INFO_PAGE_FAULTS |
| Replication Lag | OUTSIDE_METRIC_THRESHOLD | OPLOG_SLAVE_LAG_MASTER_TIME |
| Failed backup | CPS_SNAPSHOT_FAILED | - |
| Restored backup | CPS_RESTORE_SUCCESSFUL | - |
| Fallback snapshot failed | CPS_SNAPSHOT_FALLBACK_FAILED | - |
| Backup schedule behind | CPS_SNAPSHOT_BEHIND | - |
| Queues: Readers | OUTSIDE_METRIC_THRESHOLD | GLOBAL_LOCK_CURRENT_QUEUE_READERS |
| Queues: Writers | OUTSIDE_METRIC_THRESHOLD | GLOBAL_LOCK_CURRENT_QUEUE_WRITERS |
| Restarts last hour | OUTSIDE_METRIC_THRESHOLD | RESTARTS_IN_LAST_HOUR |
| Replica set elected a new primary | PRIMARY_ELECTED | - |
| System: CPU (User) % | OUTSIDE_METRIC_THRESHOLD | NORMALIZED_SYSTEM_CPU_USER |
| Disk space % used on Data Partition | OUTSIDE_METRIC_THRESHOLD | DISK_PARTITION_SPACE_USED_DATA |

## Directory Structure

```
atlas-alerts-creation/
├── README.md                           # This file
├── run_alerts.sh                       # Bash wrapper script
├── create_atlas_alerts.py              # Main Python script
├── requirements.txt                    # Python dependencies
├── atlas_alert_configurations.xlsx     # Excel configuration (user provided)
├── alerts/                             # Generated JSON files
│   ├── 01_oplog_window_low.json
│   ├── 02_oplog_window_high.json
│   └── ...
└── logs/                               # Execution logs
    └── alert_creation_YYYYMMDD_HHMMSS.log
```

## Troubleshooting

### Atlas CLI Not Found

```bash
# Verify installation
which atlas
atlas --version

# If not found, reinstall following the installation steps above
```

### Authentication Failed

```bash
# Check current authentication
atlas auth whoami

# Re-authenticate if needed
atlas auth login

# List available profiles
atlas config list
```

### Permission Denied

Ensure your API key has **Project Owner** role for the target project:
1. Go to Atlas UI > Access Manager > API Keys
2. Verify the key has Project Owner permissions

### Invalid Metric Name

Some metrics may have different names depending on your Atlas version. Check the [MongoDB Atlas Alert Conditions Reference](https://www.mongodb.com/docs/atlas/reference/alert-conditions/) for the latest metric names.

### Verify Created Alerts

1. Go to Atlas UI
2. Navigate to your project
3. Click on **Alerts** in the left sidebar
4. Click on **Alert Settings** tab
5. Review the created alerts

### Delete Alerts

To manually delete an alert:

```bash
# List all alerts
atlas alerts settings list --projectId YOUR_PROJECT_ID

# Delete a specific alert
atlas alerts settings delete ALERT_ID --projectId YOUR_PROJECT_ID --force
```

## Excel File Format

The Excel file should have the following columns:

| Column | Description |
|--------|-------------|
| Alert Name | Human-readable name of the alert |
| Alert Type/Category | Category (Replica Set, Host, Cloud Backup, etc.) |
| Low Priority Threshold | Threshold for low priority alerts |
| High Priority Threshold | Threshold for high priority alerts |
| Key Insights | Description of what the alert monitors |
| status | Can be ignored (tracking column) |

### Threshold Format Examples

- `> 4000 for 2 minutes` - Greater than 4000 for 2 minutes
- `< 24h for 5 minutes` - Less than 24 hours for 5 minutes
- `> 50ms for 5 minutes` - Greater than 50 milliseconds for 5 minutes
- `> 2GB for 15 minutes` - Greater than 2 gigabytes for 15 minutes
- `> 90%` - Greater than 90 percent
- `Any occurrence` - Alert on any occurrence (event-based)
- `15 minutes` - Duration-based threshold

## Reference Documentation

- [Atlas CLI alerts settings create](https://www.mongodb.com/docs/atlas/cli/current/command/atlas-alerts-settings-create/)
- [Alert Configuration File format](https://www.mongodb.com/docs/atlas/cli/current/reference/json/alert-config-file/)
- [Alert Conditions Reference](https://www.mongodb.com/docs/atlas/reference/alert-conditions/)
- [Recommended Alert Configurations](https://www.mongodb.com/docs/atlas/architecture/current/monitoring-alerts/#recommended-atlas-alert-configurations)

## Notes

- Low and high priority thresholds create separate alerts when values differ
- Event-based alerts (like "Failed backup") trigger on any occurrence
- The script continues processing if individual alerts fail
- All alerts include `GROUP_OWNER` notification by default
- Review and customize thresholds before running in production
