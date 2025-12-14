# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Setup & Commands

```bash
# Setup
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Set credentials
export OPS_MANAGER_BASE_URL=https://opsmanager.example.com:8080
export OPS_MANAGER_PUBLIC_KEY=your_public_key
export OPS_MANAGER_PRIVATE_KEY=your_private_key

# Usage
./run_alerts.sh --project-id PROJECT_ID --dry-run     # Preview
./run_alerts.sh --project-id PROJECT_ID               # Create alerts
./run_alerts.sh --project-id PROJECT_ID --ca-cert /path/to/ca.crt  # Self-signed cert
./run_alerts.sh --project-id PROJECT_ID --delete-existing  # Remove automation alerts
```

## Architecture

Python script that creates Ops Manager alerts from Excel config via Ops Manager API (HTTP Digest auth).

### Differences from Atlas Version
- Uses HTTP Digest authentication (not Atlas CLI)
- Direct API calls to your Ops Manager server
- Different event types: `BACKUP_AGENT_DOWN`, `MONITORING_AGENT_DOWN`, `AUTOMATION_AGENT_DOWN`
- No Cloud Backup alerts (`CPS_SNAPSHOT_*` not available)

### How It Works
1. Reads thresholds from `opsmanager_alert_configurations.xlsx`
2. Maps alert names to metric names via `ALERT_MAPPINGS` dict
3. Generates JSON files in `alerts/`
4. POSTs to `/api/public/v1.0/groups/{PROJECT-ID}/alertConfigs`
5. Tracks IDs in `.automation_alert_ids.json`

### Key Files
- `create_opsmanager_alerts.py` - Main script with `ALERT_MAPPINGS`
- `opsmanager_alert_configurations.xlsx` - Alert thresholds
- `generate_excel_template.py` - Regenerate default Excel template
- `run_alerts.sh` - Bash wrapper

### Finding Metric Names
Create alert manually in Ops Manager UI, then query API:
```bash
curl -sk -u "${PUBLIC_KEY}:${PRIVATE_KEY}" --digest \
  "${BASE_URL}/api/public/v1.0/groups/${PROJECT_ID}/alertConfigs" \
  | python3 -c "import sys,json;data=json.load(sys.stdin);[print(json.dumps(a,indent=2)) for a in data.get('results',[]) if 'DISK' in str(a)]"
```
