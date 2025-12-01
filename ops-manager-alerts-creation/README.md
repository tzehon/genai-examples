# MongoDB Ops Manager Alert Automation

Automation script to create MongoDB Ops Manager alerts from an Excel configuration file using the Ops Manager API.

**IMPORTANT: These are AUTOMATED ALERTS - NOT default Ops Manager alerts.**

## Table of Contents

- [Why This Exists](#why-this-exists)
- [How It Works](#how-it-works)
- [What This Script Does (And Doesn't Do)](#what-this-script-does-and-doesnt-do)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Usage](#usage)
- [Command Line Arguments](#command-line-arguments)
- [Alert Configuration](#alert-configuration)
- [Troubleshooting](#troubleshooting)
- [Finding Metric Names for New Alerts](#finding-metric-names-for-new-alerts)
- [Reference Documentation](#reference-documentation)

## Why This Exists

MongoDB provides recommended alert configurations to help teams monitor their deployments effectively. However, implementing these recommendations manually requires significant effort across multiple projects.

This tool automates the process: define your alert configurations once in a spreadsheet, then deploy them consistently across any number of Ops Manager projects using the API.

**Key Differences from Atlas:**
- Uses HTTP Digest authentication with API keys (not Atlas CLI)
- Direct API calls to your Ops Manager server
- Different event types available (no Cloud Backup alerts like `CPS_SNAPSHOT_*`)
- Includes Ops Manager-specific alerts (Agent alerts, Backup agent alerts)

## How It Works

This tool follows a simple workflow:

```
┌─────────────────────┐     ┌──────────────────────┐     ┌─────────────────────┐
│  Excel Config File  │ ──▶ │  Python Script       │ ──▶ │  Ops Manager API    │
│  (your thresholds)  │     │  (generates JSON)    │     │  (creates alerts)   │
└─────────────────────┘     └──────────────────────┘     └─────────────────────┘
```

### Step-by-Step Flow

1. **Read Configuration**: The script reads `opsmanager_alert_configurations.xlsx` which contains:
   - Alert names (e.g., "Replication Lag", "Disk space % used on Data Partition")
   - Low priority thresholds (e.g., "> 80% for 5 minutes")
   - High priority thresholds (e.g., "> 90% for 5 minutes")

2. **Generate JSON Files**: For each alert in the Excel file, the script:
   - Looks up the alert in `ALERT_MAPPINGS` (defined in `create_opsmanager_alerts.py`)
   - Converts your threshold strings into Ops Manager API format
   - Generates a JSON file in the `./alerts/` directory

3. **Create Alerts via API**: The script then:
   - Authenticates to your Ops Manager using HTTP Digest Auth
   - Sends each JSON configuration to the `/alertConfigs` API endpoint
   - Tracks created alert IDs in `.automation_alert_ids.json` for future cleanup

### Example: What Happens Behind the Scenes

When you define an alert like this in Excel:

| Alert Name | Low Threshold | High Threshold |
|------------|---------------|----------------|
| Replication Lag | > 60s for 5 minutes | > 120s for 2 minutes |

The script generates this JSON and sends it to the API:

```json
{
  "eventTypeName": "OUTSIDE_METRIC_THRESHOLD",
  "enabled": true,
  "matchers": [],
  "notifications": [
    {
      "typeName": "GROUP",
      "intervalMin": 60,
      "delayMin": 5,
      "emailEnabled": true,
      "smsEnabled": false
    }
  ],
  "metricThreshold": {
    "metricName": "OPLOG_SLAVE_LAG_MASTER_TIME",
    "operator": "GREATER_THAN",
    "threshold": 60.0,
    "units": "SECONDS",
    "mode": "AVERAGE"
  }
}
```

## What This Script Does (And Doesn't Do)

### What It Does

- **Creates alert configurations** in your Ops Manager project via the official API
- **Generates JSON files** locally so you can review what will be created
- **Tracks alert IDs** so you can delete only automation-created alerts later
- **Supports dry-run mode** to preview without making any changes

### What It Doesn't Do

- **Does NOT modify existing alerts** - it only creates new ones
- **Does NOT access your MongoDB data** - it only talks to the Ops Manager API
- **Does NOT store credentials** - API keys are passed at runtime only
- **Does NOT make destructive changes** unless you explicitly use `--delete-existing` or `--delete-all`

### Security Considerations

- All API communication uses HTTPS (configurable)
- Authentication uses HTTP Digest Auth (credentials never sent in plain text)
- You can review generated JSON files in `./alerts/` before running without `--dry-run`
- The script requires explicit confirmation before deleting any alerts

## Prerequisites

- Python 3.8+
- MongoDB Ops Manager 4.0+ with API access
- API Key with appropriate permissions (Project Owner or Organization Owner)
- Excel file `opsmanager_alert_configurations.xlsx` with alert definitions

## Quick Start

### 1. Create API Keys in Ops Manager

1. Navigate to your Ops Manager instance
2. Go to **Access Manager** > **API Keys**
3. Create a new API key with **Project Owner** role
4. Save the **Public Key** and **Private Key** securely

### 2. Set Up Environment

```bash
cd ops-manager-alerts-creation
chmod +x run_alerts.sh

# Set environment variables (recommended)
export OPS_MANAGER_BASE_URL=https://opsmanager.example.com:8080
export OPS_MANAGER_PUBLIC_KEY=your_public_key
export OPS_MANAGER_PRIVATE_KEY=your_private_key
```

### 3. Preview What Will Be Created (Dry Run)

```bash
./run_alerts.sh --project-id YOUR_PROJECT_ID --dry-run
```

This generates JSON files in `./alerts/` without creating any alerts. Review them to ensure they match your expectations.

### 4. Create the Alerts

```bash
./run_alerts.sh --project-id YOUR_PROJECT_ID
```

### 5. Verify in Ops Manager UI

1. Go to Ops Manager UI
2. Navigate to your project
3. Click on **Alerts** > **Alert Settings**
4. Review the created alerts

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
  --project-id YOUR_PROJECT_ID \
  --notification-email alerts@yourcompany.com \
  --notification-email oncall@yourcompany.com
```

### Using Self-Signed Certificates

If your Ops Manager uses a self-signed certificate:

```bash
# Option 1: Provide CA certificate (recommended)
./run_alerts.sh --project-id YOUR_PROJECT_ID --ca-cert /path/to/ca.crt

# Option 2: Disable SSL verification (not recommended for production)
./run_alerts.sh --project-id YOUR_PROJECT_ID --no-verify-ssl
```

### Delete Automation-Created Alerts Only

```bash
./run_alerts.sh --project-id YOUR_PROJECT_ID --delete-existing
```

Deletes only alerts created by this automation (tracked in `.automation_alert_ids.json`). Default alerts are preserved.

### Delete ALL Alerts

```bash
./run_alerts.sh --project-id YOUR_PROJECT_ID --delete-all
```

Deletes ALL alerts including default alerts. Requires typing "delete all" to confirm.

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
| `--ca-cert` | No | `OPS_MANAGER_CA_CERT` env | Path to CA certificate for SSL verification |
| `--no-verify-ssl` | No | false | Disable SSL verification (not recommended for production) |

*Required unless `--dry-run` is specified

## Alert Configuration

### Supported Alert Types

#### Replica Set Alerts

| Alert Name | Event Type | Metric Name |
|------------|------------|-------------|
| Oplog Window | REPLICATION_OPLOG_WINDOW_RUNNING_OUT | - |
| Replication Lag | OUTSIDE_METRIC_THRESHOLD | OPLOG_SLAVE_LAG_MASTER_TIME |
| Replica set has no primary | NO_PRIMARY | - |
| Replica set elected a new primary | PRIMARY_ELECTED | - |

#### Host Alerts

| Alert Name | Event Type | Metric Name |
|------------|------------|-------------|
| Host is Down | HOST_DOWN | - |
| Host is recovering | HOST_RECOVERING | - |
| Swap Usage | OUTSIDE_METRIC_THRESHOLD | SWAP_USAGE_USED |
| System: CPU (User) % | OUTSIDE_METRIC_THRESHOLD | NORMALIZED_SYSTEM_CPU_USER |
| System: CPU (System) % | OUTSIDE_METRIC_THRESHOLD | NORMALIZED_SYSTEM_CPU_KERNEL |
| Page Faults | OUTSIDE_METRIC_THRESHOLD | EXTRA_INFO_PAGE_FAULTS |
| Queues: Readers | OUTSIDE_METRIC_THRESHOLD | GLOBAL_LOCK_CURRENT_QUEUE_READERS |
| Queues: Writers | OUTSIDE_METRIC_THRESHOLD | GLOBAL_LOCK_CURRENT_QUEUE_WRITERS |
| Tickets Available: Reads | OUTSIDE_METRIC_THRESHOLD | TICKETS_AVAILABLE_READS |
| Tickets Available: Writes | OUTSIDE_METRIC_THRESHOLD | TICKETS_AVAILABLE_WRITES |
| Connections | OUTSIDE_METRIC_THRESHOLD | CONNECTIONS |
| Asserts: Regular | OUTSIDE_METRIC_THRESHOLD | ASSERT_REGULAR |
| Restarts last hour | OUTSIDE_METRIC_THRESHOLD | RESTARTS_IN_LAST_HOUR |

#### Disk Partition Alerts

These alerts monitor disk metrics on the DATA partition. Metric names include the `_DATA` suffix.

| Alert Name | Event Type | Metric Name |
|------------|------------|-------------|
| Disk read IOPS on Data Partition | OUTSIDE_METRIC_THRESHOLD | DISK_PARTITION_READ_IOPS_DATA |
| Disk write IOPS on Data Partition | OUTSIDE_METRIC_THRESHOLD | DISK_PARTITION_WRITE_IOPS_DATA |
| Disk read latency on Data Partition | OUTSIDE_METRIC_THRESHOLD | DISK_PARTITION_READ_LATENCY_DATA |
| Disk write latency on Data Partition | OUTSIDE_METRIC_THRESHOLD | DISK_PARTITION_WRITE_LATENCY_DATA |
| Disk space % used on Data Partition | OUTSIDE_METRIC_THRESHOLD | DISK_PARTITION_SPACE_USED_DATA |

**Note:** To monitor other partitions (JOURNAL, INDEX), use the corresponding suffix (e.g., `DISK_PARTITION_SPACE_USED_JOURNAL`).

#### Backup Alerts (Ops Manager Specific)

| Alert Name | Event Type | Type Name |
|------------|------------|-----------|
| Backup Oplog Behind | OPLOG_BEHIND | BACKUP |
| Backup Resync Required | RESYNC_REQUIRED | BACKUP |
| Backup Agent Down | BACKUP_AGENT_DOWN | BACKUP |

#### Agent Alerts (Ops Manager Specific)

| Alert Name | Event Type | Type Name |
|------------|------------|-----------|
| Monitoring Agent Down | MONITORING_AGENT_DOWN | AGENT |
| Automation Agent Down | AUTOMATION_AGENT_DOWN | AGENT |

### Excel File Format

The Excel file defines **what thresholds to use**. The script's `ALERT_MAPPINGS` defines **what metric names to use**.

| Column | Description |
|--------|-------------|
| Alert Name | Must exactly match a key in `ALERT_MAPPINGS` (in `create_opsmanager_alerts.py`) |
| Alert Type/Category | Category (Replica Set, Host, Backup, Agent) - for documentation only |
| Low Priority Threshold | Threshold for low priority alerts (e.g., `> 80% for 5 minutes`) |
| High Priority Threshold | Threshold for high priority alerts (e.g., `> 90% for 5 minutes`) |
| Key Insights | Description of what the alert monitors - for documentation only |

**How it works:**
1. Script reads Alert Name from Excel (e.g., "Disk read IOPS on Data Partition")
2. Looks up that name in `ALERT_MAPPINGS` to get the metric name (e.g., `DISK_PARTITION_READ_IOPS_DATA`)
3. Combines the metric name with the threshold from Excel to create the alert

**To fix metric name errors:** Update `ALERT_MAPPINGS` in the Python script, not the Excel file.

### Threshold Format Examples

| Format | Description |
|--------|-------------|
| `> 4000 for 2 minutes` | Greater than 4000 for 2 minutes |
| `< 24h for 5 minutes` | Less than 24 hours for 5 minutes |
| `> 50ms for 5 minutes` | Greater than 50 milliseconds for 5 minutes |
| `> 2GB for 15 minutes` | Greater than 2 gigabytes for 15 minutes |
| `> 90%` | Greater than 90 percent |
| `Any occurrence` | Alert on any occurrence (event-based) |
| `15 minutes` | Duration-based threshold |

### Regenerate Excel Template

To regenerate the default Excel template with all configured alerts:

```bash
python generate_excel_template.py
```

## Directory Structure

```
ops-manager-alerts-creation/
├── README.md                               # This file
├── run_alerts.sh                           # Bash wrapper script
├── create_opsmanager_alerts.py             # Main Python script
├── generate_excel_template.py              # Excel template generator
├── requirements.txt                        # Python dependencies
├── opsmanager_alert_configurations.xlsx    # Excel configuration (edit this!)
├── .automation_alert_ids.json              # Tracked alert IDs (auto-generated)
├── alerts/                                 # Generated JSON files (auto-generated)
│   ├── 01_oplog_window_low.json
│   ├── 02_oplog_window_high.json
│   └── ...
└── logs/                                   # Execution logs (auto-generated)
    └── alert_creation_YYYYMMDD_HHMMSS.log
```

## Troubleshooting

### Connection Failed

```
Failed to connect to Ops Manager: Connection error
```

1. Verify the base URL is correct and accessible
2. Check firewall rules allow access to the Ops Manager port
3. Ensure HTTPS certificate is valid or use `--ca-cert` for self-signed certificates

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

### Disk Partition Alerts Failing

If disk partition alerts fail with 500 errors, the metric names may differ in your Ops Manager version. To find the correct names:

1. Create a disk alert manually via the Ops Manager UI
2. Query the alert config via API to see the exact metric name used:
   ```bash
   curl -sk -u "${PUBLIC_KEY}:${PRIVATE_KEY}" --digest \
     "${BASE_URL}/api/public/v1.0/groups/${PROJECT_ID}/alertConfigs" \
     | python3 -c "import sys,json;data=json.load(sys.stdin);[print(json.dumps(a,indent=2)) for a in data.get('results',[]) if 'DISK' in str(a)]"
   ```
3. Update the metric name in `create_opsmanager_alerts.py` to match

### Invalid Metric Name

Some metrics may have different names depending on your Ops Manager version. See [Finding Metric Names](#finding-metric-names-for-new-alerts) below for how to discover available metrics.

## Finding Metric Names for New Alerts

If you need to add a new alert type or if alerts fail with 500 errors, you'll need to find the correct metric name that Ops Manager expects.

**Important:** Metric names can vary between Ops Manager versions and deployment types. The most reliable method is to create an alert manually via the UI and inspect it via the API.

### Method 1: Create Manually and Inspect (Recommended)

This is the most reliable method to find exact metric names for your Ops Manager version:

1. **Create the alert manually** in the Ops Manager UI:
   - Go to your project → Alerts → Alert Settings
   - Click "Add" to create a new alert
   - Configure the alert type you want (e.g., CPU, Disk, etc.)
   - Save the alert

2. **Query the alert via API** to see the exact JSON structure:

```bash
# Set your credentials
export PROJECT_ID="your_project_id"
export PUBLIC_KEY="your_public_key"
export PRIVATE_KEY="your_private_key"
export BASE_URL="https://your-opsmanager:8080"

# Get all alerts and filter by keyword (e.g., CPU, DISK, MEMORY)
curl -sk -u "${PUBLIC_KEY}:${PRIVATE_KEY}" --digest \
  "${BASE_URL}/api/public/v1.0/groups/${PROJECT_ID}/alertConfigs" \
  | python3 -c "import sys,json;data=json.load(sys.stdin);[print(json.dumps(a,indent=2)) for a in data.get('results',[]) if 'CPU' in str(a)]"
```

Replace `'CPU'` with your search term: `'DISK'`, `'MEMORY'`, `'OPLOG'`, etc.

3. **Copy the exact metric name** from the output:

```json
{
  "metricThreshold": {
    "metricName": "NORMALIZED_SYSTEM_CPU_USER",  // <-- Use this exact name
    "mode": "AVERAGE",
    "operator": "GREATER_THAN",
    "threshold": 80.0,
    "units": "RAW"
  }
}
```

4. **Update the script** with the correct metric name in `ALERT_MAPPINGS`

5. **Delete the manually created alert** (optional) and re-run the automation

### Method 2: Query Available Metrics via API

Get a list of available measurements for a specific host:

```bash
# Set your credentials
export PROJECT_ID="your_project_id"
export PUBLIC_KEY="your_public_key"
export PRIVATE_KEY="your_private_key"
export BASE_URL="https://your-opsmanager:8080"

# Step 1: Get a host ID from your project
curl -sk -u "${PUBLIC_KEY}:${PRIVATE_KEY}" --digest \
  "${BASE_URL}/api/public/v1.0/groups/${PROJECT_ID}/hosts" \
  | python3 -c "import sys,json; [print(f\"ID: {h['id']}  Host: {h.get('hostname','N/A')}\") for h in json.load(sys.stdin).get('results',[])[:5]]"

# Step 2: Set the HOST_ID from the output above
export HOST_ID="your_host_id_from_step_1"

# Step 3: Query metrics and filter for DISK and CPU related ones
curl -sk -u "${PUBLIC_KEY}:${PRIVATE_KEY}" --digest \
  "${BASE_URL}/api/public/v1.0/groups/${PROJECT_ID}/hosts/${HOST_ID}/measurements?granularity=PT1M&period=PT1H" \
  | python3 -c "import sys,json;data=json.load(sys.stdin);metrics=sorted(set(m.get('name','') for m in data.get('measurements',[])));print('=== DISK METRICS ===');disk=[m for m in metrics if 'DISK' in m.upper()];print(chr(10).join(disk) if disk else '(none found)');print();print('=== CPU METRICS ===');cpu=[m for m in metrics if 'CPU' in m.upper()];print(chr(10).join(cpu) if cpu else '(none found)')"
```

To see ALL available metrics (not just DISK/CPU):

```bash
curl -sk -u "${PUBLIC_KEY}:${PRIVATE_KEY}" --digest \
  "${BASE_URL}/api/public/v1.0/groups/${PROJECT_ID}/hosts/${HOST_ID}/measurements?granularity=PT1M&period=PT1H" \
  | python3 -c "import sys,json;data=json.load(sys.stdin);metrics=sorted(set(m.get('name','') for m in data.get('measurements',[])));print(chr(10).join(metrics))"
```

**Note:** Use `-k` flag if your Ops Manager uses a self-signed certificate.

### Method 3: Check Existing Alert Configurations

List existing alerts to see what metric names are used:

```bash
curl -sk -u "${PUBLIC_KEY}:${PRIVATE_KEY}" --digest \
  "${BASE_URL}/api/public/v1.0/groups/${PROJECT_ID}/alertConfigs"
```

This shows the full JSON configuration including `metricThreshold.metricName` for metric-based alerts.

### Adding a New Alert Type to the Script

Once you have the metric name, add it to the `ALERT_MAPPINGS` dictionary in `create_opsmanager_alerts.py`:

```python
ALERT_MAPPINGS = {
    # ... existing mappings ...

    "Your New Alert Name": {
        "event_type": "OUTSIDE_METRIC_THRESHOLD",
        "metric_name": "METRIC_NAME_FROM_API",
        "units": "RAW",  # or BYTES, MILLISECONDS, SECONDS (NOT PERCENT - use RAW for percentages)
    },
}
```

Then add a corresponding row to the Excel file with the alert name and thresholds.

### Common Units

| Unit | When to Use |
|------|-------------|
| `RAW` | Counts, numbers, percentages (connections, IOPS, CPU %, disk space %) |
| `BYTES` | Memory, disk space in bytes |
| `MILLISECONDS` | Latency measurements |
| `SECONDS` | Time durations (replication lag, oplog window) |

**Note:** Percentage values like CPU % use `RAW` units (values 0-100), not `PERCENT`.

## Differences from Atlas

This project is adapted from the Atlas alert automation tool. Key differences:

| Feature | Atlas | Ops Manager |
|---------|-------|-------------|
| Authentication | Atlas CLI | HTTP Digest Auth with API Keys |
| Base URL | `cloud.mongodb.com` | Your Ops Manager server |
| Cloud Backup Alerts | `CPS_SNAPSHOT_*` events | `OPLOG_BEHIND`, `RESYNC_REQUIRED` |
| Agent Alerts | N/A | `MONITORING_AGENT_DOWN`, `AUTOMATION_AGENT_DOWN` |
| Election Tracking | `TOO_MANY_ELECTIONS` | `PRIMARY_ELECTED` events |

## API Reference

This script uses the Ops Manager API v1.0:

- **Base URL**: `https://{OPSMANAGER-HOST}:{PORT}/api/public/v1.0`
- **Authentication**: HTTP Digest Authentication
- **Endpoints Used**:
  - `GET /groups/{PROJECT-ID}` - Get project info
  - `GET /groups/{PROJECT-ID}/alertConfigs` - List alert configurations
  - `POST /groups/{PROJECT-ID}/alertConfigs` - Create alert configuration
  - `DELETE /groups/{PROJECT-ID}/alertConfigs/{ALERT-ID}` - Delete alert configuration

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
- All alerts include GROUP notification by default (notifies project members)
- Review and customize thresholds in the Excel file before running in production
- Tracked alert IDs are stored per project in `.automation_alert_ids.json`
