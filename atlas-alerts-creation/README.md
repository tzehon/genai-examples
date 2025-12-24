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
| Number of elections in last hour | TOO_MANY_ELECTIONS | - |
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

Some metrics may have different names depending on your Atlas version. See [Finding Metric Names for New Alerts](#finding-metric-names-for-new-alerts) below for how to discover available metrics.

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

The Excel file defines **what thresholds to use**. The script's `ALERT_MAPPINGS` defines **what metric names to use**.

| Column | Description |
|--------|-------------|
| Alert Name | Must exactly match a key in `ALERT_MAPPINGS` (in `create_atlas_alerts.py`) |
| Alert Type/Category | Category (Replica Set, Host, Cloud Backup, etc.) - for documentation only |
| Low Priority Threshold | Threshold for low priority alerts (e.g., `> 80% for 5 minutes`) |
| High Priority Threshold | Threshold for high priority alerts (e.g., `> 90% for 5 minutes`) |
| Key Insights | Description of what the alert monitors - for documentation only |

**How it works:**
1. Script reads Alert Name from Excel (e.g., "Disk read IOPS on Data Partition")
2. Looks up that name in `ALERT_MAPPINGS` to get the metric name (e.g., `DISK_PARTITION_READ_IOPS_DATA`)
3. Combines the metric name with the threshold from Excel to create the alert

**To fix metric name errors:** Update `ALERT_MAPPINGS` in the Python script, not the Excel file.

### Threshold Format Examples

- `> 4000 for 2 minutes` - Greater than 4000 for 2 minutes
- `< 24h for 5 minutes` - Less than 24 hours for 5 minutes
- `> 50ms for 5 minutes` - Greater than 50 milliseconds for 5 minutes
- `> 2GB for 15 minutes` - Greater than 2 gigabytes for 15 minutes
- `> 90%` - Greater than 90 percent
- `Any occurrence` - Alert on any occurrence (event-based)
- `15 minutes` - Duration-based threshold

## Extending and Modifying Alerts

### Adding New Alerts

To add a new alert, you need to update two files:

**Step 1: Add mapping to `create_atlas_alerts.py`**

Add an entry to the `ALERT_MAPPINGS` dictionary (around line 42):

```python
"Your Alert Name": {
    "event_type": "EVENT_TYPE_NAME",    # Required: Atlas event type
    "metric_name": "METRIC_NAME",        # Optional: for metric-based alerts, or None
    "units": "RAW",                      # Optional: BYTES, MILLISECONDS, SECONDS, HOURS, RAW
    "uses_threshold": True,              # Optional: for event-based alerts with thresholds
}
```

**Step 2: Add a row to `atlas_alert_configurations.xlsx`**

Add a row with these columns:
- **Alert Name** - Must exactly match the key in `ALERT_MAPPINGS`
- **Low Priority Threshold** - e.g., `> 4000 for 2 minutes`
- **High Priority Threshold** - Different threshold, or leave empty if same as low

### Alert Types

| Type | Description | Example |
|------|-------------|---------|
| Metric-based | Uses `OUTSIDE_METRIC_THRESHOLD` event with a `metric_name` | Disk IOPS, CPU % |
| Event with threshold | Event type with `uses_threshold: True` | Elections, Host Down |
| Pure event | No threshold, fires on any occurrence | Failed Backup, No Primary |

### Changing Thresholds

Edit the threshold columns in `atlas_alert_configurations.xlsx`. Supported formats:

| Format | Example | Description |
|--------|---------|-------------|
| Basic comparison | `> 4000 for 2 minutes` | Value exceeds 4000 for 2 minutes |
| Time-based | `< 24h for 5 minutes` | Less than 24 hours for 5 minutes |
| Milliseconds | `> 50ms for 5 minutes` | Latency over 50ms |
| Size-based | `> 2GB for 15 minutes` | Size exceeds 2GB |
| Percentage | `> 80%` | Percentage threshold |
| Event-based | `Any occurrence` | Fires on any occurrence |
| Duration only | `15 minutes` | Duration-based threshold |

### Key Conventions

1. **Low vs High priority**: System creates separate alerts when thresholds differ
2. **Duplicate detection**: Alerts with identical `(event_type, metric_name, threshold, duration)` are auto-skipped
3. **File naming**: JSON files are auto-generated as `{number}_{alert_name}_{priority}.json`
4. **Test first**: Always use `--dry-run` to validate before deploying
5. **delayMin**: Automatically set from threshold duration (when first notification fires)
6. **Notification interval**: Fixed at 60 minutes for all GROUP notifications

### Example: Adding a Connection Count Alert

1. Add to `ALERT_MAPPINGS` in `create_atlas_alerts.py`:
```python
"Connection Count": {
    "event_type": "OUTSIDE_METRIC_THRESHOLD",
    "metric_name": "CONNECTIONS",
    "units": "RAW",
}
```

2. Add row to Excel file:
   - Alert Name: `Connection Count`
   - Low Priority Threshold: `> 500 for 5 minutes`
   - High Priority Threshold: `> 1000 for 2 minutes`

3. Test with dry run:
```bash
./run_alerts.sh --project-id YOUR_PROJECT_ID --dry-run
```

4. Review generated JSON in `alerts/` directory, then deploy.

## Finding Metric Names for New Alerts

If you need to add a new alert type or if alerts fail with errors, you'll need to find the correct metric name that Atlas expects.

**Important:** Metric names can vary between Atlas versions. The most reliable method is to create an alert manually via the UI and inspect it via the CLI/API.

### Method 1: Create Manually and Inspect (Recommended)

This is the most reliable method to find exact metric names:

1. **Create the alert manually** in the Atlas UI:
   - Go to your project → Alerts → Alert Settings
   - Click "Add New Alert"
   - Configure the alert type you want (e.g., CPU, Disk, etc.)
   - Save the alert

2. **Get the alert config ID** from the Atlas UI:
   - Click to edit the alert you just created
   - Copy the `alertConfigId` from the URL, e.g.:
     `https://cloud.mongodb.com/v2/YOUR_PROJECT_ID#/alerts/manage/active?operation=Edit&alertConfigId=YOUR_ALERT_CONFIG_ID`

3. **Query the specific alert via Atlas CLI** to see the exact JSON structure:

```bash
# Describe the specific alert configuration
atlas alerts settings describe YOUR_ALERT_CONFIG_ID --projectId YOUR_PROJECT_ID --output json
```

4. **Copy the exact event type, metric name, and units** from the output:

```json
{
  "eventTypeName": "OUTSIDE_METRIC_THRESHOLD",
  "metricThreshold": {
    "metricName": "NORMALIZED_SYSTEM_CPU_USER",
    "mode": "AVERAGE",
    "operator": "GREATER_THAN",
    "threshold": 80.0,
    "units": "RAW"
  }
}
```

   - `eventTypeName` → maps to `event_type` in `ALERT_MAPPINGS`
   - `metricName` → maps to `metric_name`
   - `units` → can be `RAW`, `BYTES`, `MILLISECONDS`, `SECONDS`, or `HOURS`

5. **Update the script** with these values in `ALERT_MAPPINGS`

6. **Delete the manually created alert** (optional) and re-run the automation:
```bash
atlas alerts settings delete ALERT_ID --projectId YOUR_PROJECT_ID --force
```

### Method 2: Query Available Metrics via Atlas CLI

Get a list of available measurements for a specific process (MongoDB instance):

```bash
# List all processes (hosts) in your project
atlas processes list --projectId YOUR_PROJECT_ID

# Get available measurements for a specific process
# The process ID is in the format: hostname:port
atlas metrics processes YOUR_PROCESS_ID --projectId YOUR_PROJECT_ID --granularity PT1M --period PT1H
```

Example output shows available metric names:
```
ASSERT_MSG
ASSERT_REGULAR
CONNECTIONS
DISK_PARTITION_READ_IOPS_DATA
DISK_PARTITION_WRITE_IOPS_DATA
NORMALIZED_SYSTEM_CPU_USER
SWAP_USAGE_USED
...
```

### Method 3: Query Available Metrics via Atlas API

If you prefer using the API directly:

```bash
# Get measurements for a process
curl -u "PUBLIC_KEY:PRIVATE_KEY" --digest \
  "https://cloud.mongodb.com/api/atlas/v2/groups/PROJECT_ID/processes/HOSTNAME:PORT/measurements?granularity=PT1M&period=PT1H"
```

### Method 4: Check Existing Alert Configurations

List existing alerts to see what metric names are used:

```bash
# List all alert configurations
atlas alerts settings list --projectId YOUR_PROJECT_ID --output json
```

This shows the full JSON configuration including `metricThreshold.metricName` for metric-based alerts.

### Adding a New Alert Type to the Script

Once you have the metric name, add it to the `ALERT_MAPPINGS` dictionary in `create_atlas_alerts.py`:

```python
ALERT_MAPPINGS = {
    # ... existing mappings ...

    "Your New Alert Name": {
        "event_type": "OUTSIDE_METRIC_THRESHOLD",
        "metric_name": "METRIC_NAME_FROM_API",
        "units": "RAW",  # or BYTES, MILLISECONDS, SECONDS, HOURS, etc.
    },
}
```

Then add a corresponding row to the Excel file with the alert name and thresholds.

### Common Units

| Unit | When to Use |
|------|-------------|
| `RAW` | Counts, numbers, percentages (connections, IOPS, CPU %) |
| `BYTES` | Memory, disk space in bytes |
| `MILLISECONDS` | Latency measurements |
| `SECONDS` | Time durations (replication lag) |
| `HOURS` | Longer durations (oplog window) |

**Note:** Percentage values like CPU % use `RAW` units (values 0-100), not `PERCENT`.

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
