# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Setup & Commands

```bash
# Setup
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
atlas auth login  # Configure Atlas CLI

# Usage
./run_alerts.sh --project-id PROJECT_ID --dry-run     # Preview (generates JSON)
./run_alerts.sh --project-id PROJECT_ID               # Create alerts
./run_alerts.sh --project-id PROJECT_ID --delete-existing  # Remove automation alerts only
./run_alerts.sh --project-id PROJECT_ID --delete-all  # Remove ALL alerts
```

## Architecture

Python script that creates MongoDB Atlas alerts from an Excel configuration file via Atlas CLI.

### How It Works
1. Reads thresholds from `atlas_alert_configurations.xlsx`
2. Maps alert names to Atlas metric names via `ALERT_MAPPINGS` dict in `create_atlas_alerts.py`
3. Generates JSON files in `alerts/` directory
4. Creates alerts via `atlas alerts settings create` CLI command
5. Tracks created alert IDs in `.automation_alert_ids.json` for cleanup

### Key Files
- `create_atlas_alerts.py` - Main script with `ALERT_MAPPINGS` dictionary
- `atlas_alert_configurations.xlsx` - Alert thresholds (user-editable)
- `run_alerts.sh` - Bash wrapper that handles venv and arguments

### Adding New Alerts
1. Add entry to `ALERT_MAPPINGS` in `create_atlas_alerts.py`:
   ```python
   "Alert Name": {
       "event_type": "OUTSIDE_METRIC_THRESHOLD",
       "metric_name": "METRIC_NAME",
       "units": "RAW",
   }
   ```
2. Add row to Excel with Alert Name and thresholds

### Finding Metric Names
Create alert manually in Atlas UI, then query via CLI:
```bash
atlas alerts settings list --projectId PROJECT_ID --output json
```
Copy these fields from the output:
- `eventTypeName` → `event_type`
- `metricThreshold.metricName` → `metric_name`
- `metricThreshold.units` → `units`
