# MongoDB Ops Manager Alert Automation

Automation script to create MongoDB Ops Manager alerts from an Excel configuration file using the Ops Manager API.

**IMPORTANT: These are AUTOMATED ALERTS - NOT default Ops Manager alerts.**

## Why This Exists

MongoDB provides recommended alert configurations to help teams monitor their deployments effectively. However, implementing these recommendations manually requires significant effort across multiple projects.

This tool automates the process: define your alert configurations once in a spreadsheet, then deploy them consistently across any number of Ops Manager projects using the API.

**Key Differences from Atlas:**
- Uses HTTP Digest authentication with API keys (not Atlas CLI)
- Direct API calls to your Ops Manager server
- Different event types available (no Cloud Backup alerts like `CPS_SNAPSHOT_*`)
- Includes Ops Manager-specific alerts (Agent alerts, Backup agent alerts)

## Prerequisites

- Python 3.8+
- MongoDB Ops Manager 4.0+ with API access
- API Key with appropriate permissions (Project Owner or Organization Owner)
- Excel file `opsmanager_alert_configurations.xlsx` with alert definitions

## Installation

### Clone and Setup

```bash
cd ops-manager-alerts-creation
chmod +x run_alerts.sh
```

### Create API Keys in Ops Manager

1. Navigate to your Ops Manager instance
2. Go to **Access Manager** > **API Keys**
3. Create a new API key with **Project Owner** role
4. Save the **Public Key** and **Private Key** securely

## Usage

### Basic Usage

```bash
./run_alerts.sh \
  --base-url https://opsmanager.example.com:8080 \
  --public-key YOUR_PUBLIC_KEY \
  --private-key YOUR_PRIVATE_KEY \
  --project-id YOUR_PROJECT_ID
```

### Using Environment Variables

Set environment variables to avoid passing credentials on command line:

```bash
export OPS_MANAGER_BASE_URL=https://opsmanager.example.com:8080
export OPS_MANAGER_PUBLIC_KEY=your_public_key
export OPS_MANAGER_PRIVATE_KEY=your_private_key

./run_alerts.sh --project-id YOUR_PROJECT_ID
```

### Dry Run (Generate JSON Only)

Generate JSON files without creating alerts in Ops Manager:

```bash
./run_alerts.sh --project-id YOUR_PROJECT_ID --dry-run
```

### Custom Notification Email

```bash
./run_alerts.sh \
  --base-url https://opsmanager.example.com:8080 \
  --public-key YOUR_PUBLIC_KEY \
  --private-key YOUR_PRIVATE_KEY \
  --project-id YOUR_PROJECT_ID \
  --notification-email alerts@yourcompany.com \
  --notification-email oncall@yourcompany.com
```

### Delete Automation-Created Alerts Only

```bash
./run_alerts.sh \
  --base-url https://opsmanager.example.com:8080 \
  --public-key YOUR_PUBLIC_KEY \
  --private-key YOUR_PRIVATE_KEY \
  --project-id YOUR_PROJECT_ID \
  --delete-existing
```

Deletes only alerts created by this automation (tracked in `.automation_alert_ids.json`). Default alerts are preserved.

### Delete ALL Alerts

```bash
./run_alerts.sh \
  --base-url https://opsmanager.example.com:8080 \
  --public-key YOUR_PUBLIC_KEY \
  --private-key YOUR_PRIVATE_KEY \
  --project-id YOUR_PROJECT_ID \
  --delete-all
```

Deletes ALL alerts including default alerts. Requires confirmation.

## Command Line Arguments

| Argument | Required | Default | Description |
|----------|----------|---------|-------------|
| `--base-url` | Yes* | `OPS_MANAGER_BASE_URL` env | Ops Manager URL (e.g., `https://om.example.com:8080`) |
| `--public-key` | Yes* | `OPS_MANAGER_PUBLIC_KEY` env | API public key |
| `--private-key` | Yes* | `OPS_MANAGER_PRIVATE_KEY` env | API private key |
| `--project-id` | Yes | - | Ops Manager Project/Group ID |
| `--dry-run` | No | false | Generate JSON files but don't create alerts |
| `--excel-file` | No | `opsmanager_alert_configurations.xlsx` | Path to Excel configuration file |
| `--output-dir` | No | `./alerts` | Directory for generated JSON files |
| `--notification-email` | No | - | Email address(es) for notifications (repeatable) |
| `--delete-existing` | No | false | Delete automation-created alerts only, then exit |
| `--delete-all` | No | false | Delete ALL alerts (including defaults), then exit |
| `--log-dir` | No | `./logs` | Directory for log files |

*Required unless `--dry-run` is specified

## Alert Configuration Mapping

### Replica Set Alerts

| Alert Name | Event Type | Metric Name |
|------------|------------|-------------|
| Oplog Window | REPLICATION_OPLOG_WINDOW_RUNNING_OUT | - |
| Replication Lag | OUTSIDE_METRIC_THRESHOLD | OPLOG_SLAVE_LAG_MASTER_TIME |
| Replica set has no primary | NO_PRIMARY | - |
| Replica set elected a new primary | PRIMARY_ELECTED | - |

### Host Alerts

| Alert Name | Event Type | Metric Name |
|------------|------------|-------------|
| Host is Down | HOST_DOWN | - |
| Host is recovering | HOST_RECOVERING | - |
| Disk read IOPS on Data Partition | OUTSIDE_METRIC_THRESHOLD | DISK_PARTITION_IOPS_READ |
| Disk write IOPS on Data Partition | OUTSIDE_METRIC_THRESHOLD | DISK_PARTITION_IOPS_WRITE |
| Disk read latency on Data Partition | OUTSIDE_METRIC_THRESHOLD | DISK_PARTITION_LATENCY_READ |
| Disk write latency on Data Partition | OUTSIDE_METRIC_THRESHOLD | DISK_PARTITION_LATENCY_WRITE |
| Disk space % used on Data Partition | OUTSIDE_METRIC_THRESHOLD | DISK_PARTITION_SPACE_PERCENT_USED |
| Swap Usage | OUTSIDE_METRIC_THRESHOLD | SWAP_USAGE_USED |
| System: CPU (User) % | OUTSIDE_METRIC_THRESHOLD | SYSTEM_CPU_USER |
| Page Faults | OUTSIDE_METRIC_THRESHOLD | EXTRA_INFO_PAGE_FAULTS |
| Queues: Readers | OUTSIDE_METRIC_THRESHOLD | GLOBAL_LOCK_CURRENT_QUEUE_READERS |
| Queues: Writers | OUTSIDE_METRIC_THRESHOLD | GLOBAL_LOCK_CURRENT_QUEUE_WRITERS |
| Tickets Available: Reads | OUTSIDE_METRIC_THRESHOLD | TICKETS_AVAILABLE_READS |
| Tickets Available: Writes | OUTSIDE_METRIC_THRESHOLD | TICKETS_AVAILABLE_WRITES |
| Connections | OUTSIDE_METRIC_THRESHOLD | CONNECTIONS |
| Asserts: Regular | OUTSIDE_METRIC_THRESHOLD | ASSERT_REGULAR |
| Restarts last hour | OUTSIDE_METRIC_THRESHOLD | RESTARTS_IN_LAST_HOUR |

### Backup Alerts (Ops Manager Specific)

| Alert Name | Event Type | Type Name |
|------------|------------|-----------|
| Backup Oplog Behind | OPLOG_BEHIND | BACKUP |
| Backup Resync Required | RESYNC_REQUIRED | BACKUP |
| Backup Agent Down | BACKUP_AGENT_DOWN | BACKUP |

### Agent Alerts (Ops Manager Specific)

| Alert Name | Event Type | Type Name |
|------------|------------|-----------|
| Monitoring Agent Down | MONITORING_AGENT_DOWN | AGENT |
| Automation Agent Down | AUTOMATION_AGENT_DOWN | AGENT |

## Differences from Atlas

This project is adapted from the Atlas alert automation tool. Key differences:

| Feature | Atlas | Ops Manager |
|---------|-------|-------------|
| Authentication | Atlas CLI | HTTP Digest Auth with API Keys |
| Base URL | `cloud.mongodb.com` | Your Ops Manager server |
| Cloud Backup Alerts | `CPS_SNAPSHOT_*` events | `OPLOG_BEHIND`, `RESYNC_REQUIRED` |
| Agent Alerts | N/A | `MONITORING_AGENT_DOWN`, `AUTOMATION_AGENT_DOWN` |
| Election Tracking | `TOO_MANY_ELECTIONS` | `PRIMARY_ELECTED` events |

## Directory Structure

```
ops-manager-alerts-creation/
├── README.md                               # This file
├── run_alerts.sh                           # Bash wrapper script
├── create_opsmanager_alerts.py             # Main Python script
├── generate_excel_template.py              # Excel template generator
├── requirements.txt                        # Python dependencies
├── opsmanager_alert_configurations.xlsx    # Excel configuration
├── .automation_alert_ids.json              # Tracked alert IDs (generated)
├── alerts/                                 # Generated JSON files
│   ├── 01_oplog_window_low.json
│   ├── 02_oplog_window_high.json
│   └── ...
└── logs/                                   # Execution logs
    └── alert_creation_YYYYMMDD_HHMMSS.log
```

## Excel File Format

The Excel file should have the following columns:

| Column | Description |
|--------|-------------|
| Alert Name | Human-readable name of the alert (must match ALERT_MAPPINGS) |
| Alert Type/Category | Category (Replica Set, Host, Backup, Agent) |
| Low Priority Threshold | Threshold for low priority alerts |
| High Priority Threshold | Threshold for high priority alerts |
| Key Insights | Description of what the alert monitors |

### Threshold Format Examples

- `> 4000 for 2 minutes` - Greater than 4000 for 2 minutes
- `< 24h for 5 minutes` - Less than 24 hours for 5 minutes
- `> 50ms for 5 minutes` - Greater than 50 milliseconds for 5 minutes
- `> 2GB for 15 minutes` - Greater than 2 gigabytes for 15 minutes
- `> 90%` - Greater than 90 percent
- `Any occurrence` - Alert on any occurrence (event-based)
- `15 minutes` - Duration-based threshold

### Regenerate Excel Template

To regenerate the default Excel template with all configured alerts:

```bash
python generate_excel_template.py
```

## API Reference

This script uses the Ops Manager API v1.0:

- **Base URL**: `https://{OPSMANAGER-HOST}:{PORT}/api/public/v1.0`
- **Authentication**: HTTP Digest Authentication
- **Endpoints Used**:
  - `GET /groups/{PROJECT-ID}` - Get project info
  - `GET /groups/{PROJECT-ID}/alertConfigs` - List alert configurations
  - `POST /groups/{PROJECT-ID}/alertConfigs` - Create alert configuration
  - `DELETE /groups/{PROJECT-ID}/alertConfigs/{ALERT-ID}` - Delete alert configuration

## Troubleshooting

### Connection Failed

```
Failed to connect to Ops Manager: Connection error
```

1. Verify the base URL is correct and accessible
2. Check firewall rules allow access to the Ops Manager port
3. Ensure HTTPS certificate is valid or use `--base-url http://...` for non-SSL

### Authentication Failed

```
Authentication failed. Check your API keys.
```

1. Verify the public and private keys are correct
2. Ensure the API key has not expired
3. Check the API key has appropriate permissions (Project Owner)

### Permission Denied

```
Access denied. Check your API key permissions.
```

1. Ensure the API key has **Project Owner** role for the target project
2. Verify the project ID is correct

### Invalid Metric Name

Some metrics may have different names depending on your Ops Manager version. Check the [Ops Manager Alert Reference](https://www.mongodb.com/docs/ops-manager/current/reference/alerts/) for available metrics.

### Verify Created Alerts

1. Go to Ops Manager UI
2. Navigate to your project
3. Click on **Alerts** in the left sidebar
4. Click on **Alert Settings** tab
5. Review the created alerts

## Reference Documentation

- [Ops Manager Alert Configuration API](https://www.mongodb.com/docs/ops-manager/current/reference/api/alert-configurations/)
- [Create an Alert Configuration](https://www.mongodb.com/docs/ops-manager/current/reference/api/alert-configurations-create-config/)
- [Alert Event Types](https://www.mongodb.com/docs/ops-manager/current/reference/alert-types/)
- [Review Alert Conditions](https://www.mongodb.com/docs/ops-manager/current/reference/alerts/)
- [Programmatic Access to Ops Manager](https://www.mongodb.com/docs/ops-manager/current/tutorial/manage-programmatic-access/)

## Notes

- Low and high priority thresholds create separate alerts when values differ
- Event-based alerts (like "Backup Agent Down") trigger on any occurrence
- The script continues processing if individual alerts fail
- All alerts include GROUP notification by default
- Review and customize thresholds before running in production
- Tracked alert IDs are stored per project in `.automation_alert_ids.json`
