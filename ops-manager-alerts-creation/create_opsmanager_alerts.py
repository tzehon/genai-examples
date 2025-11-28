#!/usr/bin/env python3
"""
MongoDB Ops Manager Alert Configuration Script

This script reads alert configurations from an Excel file and creates
corresponding alerts in MongoDB Ops Manager using the Ops Manager API.

AUTOMATED ALERTS - NOT DEFAULT OPS MANAGER ALERTS

Key differences from Atlas:
- Uses HTTP Digest authentication with API keys (not Atlas CLI)
- Direct API calls to Ops Manager server
- Different event types and metrics available
"""

import argparse
import hashlib
import json
import logging
import os
import re
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Optional
from urllib.parse import urlparse

try:
    import requests
    from requests.auth import HTTPDigestAuth
except ImportError:
    print("ERROR: requests is required. Install with: pip install requests")
    sys.exit(1)

try:
    import openpyxl
except ImportError:
    print("ERROR: openpyxl is required. Install with: pip install openpyxl")
    sys.exit(1)


# Banner to display at script start
BANNER = """
================================================================================
  MongoDB Ops Manager Alert Configuration Script
  AUTOMATED ALERTS - NOT DEFAULT OPS MANAGER ALERTS
================================================================================
"""

# File to track automation-created alert IDs
ALERT_TRACKING_FILE = ".automation_alert_ids.json"

# Mapping of alert names to their Ops Manager configuration
# Note: Some Atlas-specific alerts (CPS_*) are not available in Ops Manager
# Ops Manager uses different event types for backup alerts
ALERT_MAPPINGS = {
    # Replication Alerts
    "Oplog Window": {
        "event_type": "REPLICATION_OPLOG_WINDOW_RUNNING_OUT",
        "metric_name": None,
        "uses_threshold": True,
    },
    "Replication Lag": {
        "event_type": "OUTSIDE_METRIC_THRESHOLD",
        "metric_name": "OPLOG_SLAVE_LAG_MASTER_TIME",
        "units": "SECONDS",
    },
    "Replica set has no primary": {
        "event_type": "NO_PRIMARY",
        "metric_name": None,
        "uses_threshold": False,
    },
    "Replica set elected a new primary": {
        "event_type": "PRIMARY_ELECTED",
        "metric_name": None,
        "uses_threshold": False,
    },
    "Number of elections": {
        # Ops Manager tracks elections via PRIMARY_ELECTED events
        "event_type": "PRIMARY_ELECTED",
        "metric_name": None,
        "uses_threshold": False,
    },

    # Host Alerts
    "Host is Down": {
        "event_type": "HOST_DOWN",
        "metric_name": None,
        "uses_threshold": True,
    },
    "Host is recovering": {
        "event_type": "HOST_RECOVERING",
        "metric_name": None,
        "uses_threshold": False,
    },

    # Disk I/O Alerts
    "Disk read IOPS on Data Partition": {
        "event_type": "OUTSIDE_METRIC_THRESHOLD",
        "metric_name": "DISK_PARTITION_IOPS_READ",
        "units": "RAW",
    },
    "Disk write IOPS on Data Partition": {
        "event_type": "OUTSIDE_METRIC_THRESHOLD",
        "metric_name": "DISK_PARTITION_IOPS_WRITE",
        "units": "RAW",
    },
    "Disk read latency on Data Partition": {
        "event_type": "OUTSIDE_METRIC_THRESHOLD",
        "metric_name": "DISK_PARTITION_LATENCY_READ",
        "units": "MILLISECONDS",
    },
    "Disk write latency on Data Partition": {
        "event_type": "OUTSIDE_METRIC_THRESHOLD",
        "metric_name": "DISK_PARTITION_LATENCY_WRITE",
        "units": "MILLISECONDS",
    },
    "Disk space % used on Data Partition": {
        "event_type": "OUTSIDE_METRIC_THRESHOLD",
        "metric_name": "DISK_PARTITION_SPACE_PERCENT_USED",
        "units": "RAW",
    },

    # System Resource Alerts
    "Swap Usage": {
        "event_type": "OUTSIDE_METRIC_THRESHOLD",
        "metric_name": "SWAP_USAGE_USED",
        "units": "BYTES",
    },
    "System: CPU (User) %": {
        "event_type": "OUTSIDE_METRIC_THRESHOLD",
        "metric_name": "SYSTEM_CPU_USER",
        "units": "RAW",
    },
    "System: CPU (System) %": {
        "event_type": "OUTSIDE_METRIC_THRESHOLD",
        "metric_name": "SYSTEM_CPU_KERNEL",
        "units": "RAW",
    },
    "Page Faults": {
        "event_type": "OUTSIDE_METRIC_THRESHOLD",
        "metric_name": "EXTRA_INFO_PAGE_FAULTS",
        "units": "RAW",
    },

    # Queue Alerts
    "Queues: Readers": {
        "event_type": "OUTSIDE_METRIC_THRESHOLD",
        "metric_name": "GLOBAL_LOCK_CURRENT_QUEUE_READERS",
        "units": "RAW",
    },
    "Queues: Writers": {
        "event_type": "OUTSIDE_METRIC_THRESHOLD",
        "metric_name": "GLOBAL_LOCK_CURRENT_QUEUE_WRITERS",
        "units": "RAW",
    },

    # Ticket Alerts (WiredTiger)
    "Tickets Available: Reads": {
        "event_type": "OUTSIDE_METRIC_THRESHOLD",
        "metric_name": "TICKETS_AVAILABLE_READS",
        "units": "RAW",
    },
    "Tickets Available: Writes": {
        "event_type": "OUTSIDE_METRIC_THRESHOLD",
        "metric_name": "TICKETS_AVAILABLE_WRITES",
        "units": "RAW",
    },

    # Connection Alerts
    "Connections": {
        "event_type": "OUTSIDE_METRIC_THRESHOLD",
        "metric_name": "CONNECTIONS",
        "units": "RAW",
    },

    # Memory Alerts
    "Memory: Resident": {
        "event_type": "OUTSIDE_METRIC_THRESHOLD",
        "metric_name": "MEMORY_RESIDENT",
        "units": "BYTES",
    },
    "Memory: Virtual": {
        "event_type": "OUTSIDE_METRIC_THRESHOLD",
        "metric_name": "MEMORY_VIRTUAL",
        "units": "BYTES",
    },

    # Assert Alerts
    "Asserts: Regular": {
        "event_type": "OUTSIDE_METRIC_THRESHOLD",
        "metric_name": "ASSERT_REGULAR",
        "units": "RAW",
    },
    "Asserts: Warning": {
        "event_type": "OUTSIDE_METRIC_THRESHOLD",
        "metric_name": "ASSERT_WARNING",
        "units": "RAW",
    },
    "Asserts: Msg": {
        "event_type": "OUTSIDE_METRIC_THRESHOLD",
        "metric_name": "ASSERT_MSG",
        "units": "RAW",
    },
    "Asserts: User": {
        "event_type": "OUTSIDE_METRIC_THRESHOLD",
        "metric_name": "ASSERT_USER",
        "units": "RAW",
    },

    # Ops Manager Backup Alerts (different from Atlas CPS_* alerts)
    "Backup Oplog Behind": {
        "event_type": "OPLOG_BEHIND",
        "metric_name": None,
        "uses_threshold": False,
        "type_name": "BACKUP",
    },
    "Backup Resync Required": {
        "event_type": "RESYNC_REQUIRED",
        "metric_name": None,
        "uses_threshold": False,
        "type_name": "BACKUP",
    },
    "Backup Agent Down": {
        "event_type": "BACKUP_AGENT_DOWN",
        "metric_name": None,
        "uses_threshold": False,
        "type_name": "BACKUP",
    },
    "Backup Config Not Consistent": {
        "event_type": "RS_BACKUP_CONFIG_NOT_CONSISTENT",
        "metric_name": None,
        "uses_threshold": False,
        "type_name": "BACKUP",
    },

    # Agent Alerts (Ops Manager specific)
    "Monitoring Agent Down": {
        "event_type": "MONITORING_AGENT_DOWN",
        "metric_name": None,
        "uses_threshold": False,
        "type_name": "AGENT",
    },
    "Automation Agent Down": {
        "event_type": "AUTOMATION_AGENT_DOWN",
        "metric_name": None,
        "uses_threshold": False,
        "type_name": "AGENT",
    },

    # Unhealthy Members
    "Unhealthy Members": {
        "event_type": "TOO_MANY_UNHEALTHY_MEMBERS",
        "metric_name": None,
        "uses_threshold": True,
    },

    # Restarts
    "Restarts last hour": {
        "event_type": "OUTSIDE_METRIC_THRESHOLD",
        "metric_name": "RESTARTS_IN_LAST_HOUR",
        "units": "RAW",
    },
}


class OpsManagerClient:
    """Client for MongoDB Ops Manager API with HTTP Digest Authentication."""

    def __init__(
        self,
        base_url: str,
        public_key: str,
        private_key: str,
        logger: logging.Logger,
    ):
        self.base_url = base_url.rstrip("/")
        self.public_key = public_key
        self.private_key = private_key
        self.logger = logger
        self.session = requests.Session()
        self.session.auth = HTTPDigestAuth(public_key, private_key)
        self.session.headers.update({
            "Content-Type": "application/json",
            "Accept": "application/json",
        })

    def _request(
        self,
        method: str,
        path: str,
        data: Optional[dict] = None,
        params: Optional[dict] = None,
    ) -> dict:
        """Make an authenticated request to the Ops Manager API."""
        url = f"{self.base_url}{path}"

        self.logger.debug(f"API Request: {method} {url}")
        if data:
            self.logger.debug(f"Request body: {json.dumps(data, indent=2)}")

        try:
            response = self.session.request(
                method=method,
                url=url,
                json=data,
                params=params,
                timeout=60,
            )

            self.logger.debug(f"Response status: {response.status_code}")

            if response.status_code == 401:
                raise Exception("Authentication failed. Check your API keys.")

            if response.status_code == 403:
                raise Exception("Access denied. Check your API key permissions.")

            if response.status_code == 404:
                raise Exception(f"Resource not found: {path}")

            if response.status_code >= 400:
                error_msg = response.text
                try:
                    error_data = response.json()
                    error_msg = error_data.get("detail", error_data.get("error", response.text))
                except json.JSONDecodeError:
                    pass
                raise Exception(f"API error ({response.status_code}): {error_msg}")

            if response.text:
                return response.json()
            return {}

        except requests.exceptions.Timeout:
            raise Exception("Request timed out")
        except requests.exceptions.ConnectionError as e:
            raise Exception(f"Connection error: {e}")

    def test_connection(self) -> bool:
        """Test the API connection."""
        try:
            # Try to get root API info
            self._request("GET", "/")
            return True
        except Exception as e:
            self.logger.error(f"Connection test failed: {e}")
            return False

    def get_project(self, project_id: str) -> dict:
        """Get project information."""
        return self._request("GET", f"/groups/{project_id}")

    def list_alert_configs(self, project_id: str) -> list:
        """List all alert configurations for a project."""
        result = self._request("GET", f"/groups/{project_id}/alertConfigs")
        return result.get("results", [])

    def create_alert_config(self, project_id: str, config: dict) -> dict:
        """Create a new alert configuration."""
        return self._request("POST", f"/groups/{project_id}/alertConfigs", data=config)

    def delete_alert_config(self, project_id: str, alert_id: str) -> bool:
        """Delete an alert configuration."""
        try:
            self._request("DELETE", f"/groups/{project_id}/alertConfigs/{alert_id}")
            return True
        except Exception as e:
            if "404" in str(e) or "NOT_FOUND" in str(e):
                return True  # Already deleted
            raise


def setup_logging(log_dir: Path) -> logging.Logger:
    """Set up logging to file and console."""
    log_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    log_file = log_dir / f"alert_creation_{timestamp}.log"

    logger = logging.getLogger("opsmanager_alerts")
    logger.setLevel(logging.DEBUG)

    # File handler
    file_handler = logging.FileHandler(log_file)
    file_handler.setLevel(logging.DEBUG)
    file_formatter = logging.Formatter(
        "%(asctime)s - %(levelname)s - %(message)s"
    )
    file_handler.setFormatter(file_formatter)

    # Console handler
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)
    console_formatter = logging.Formatter("%(message)s")
    console_handler.setFormatter(console_formatter)

    logger.addHandler(file_handler)
    logger.addHandler(console_handler)

    return logger


def parse_threshold(threshold_str: str) -> dict[str, Any]:
    """
    Parse threshold strings like:
    - "> 4000 for 2 minutes"
    - "< 24h for 5 minutes"
    - "> 50ms for 5 minutes"
    - "> 2GB for 15 minutes"
    - "> 90%"
    - "Any occurrence"
    - "15 minutes"
    - "> 0-10"
    - "> 10+"

    Returns a dict with:
    - operator: GREATER_THAN or LESS_THAN
    - threshold: numeric value
    - units: time unit for threshold
    - duration_minutes: how long condition must persist
    """
    if not threshold_str or threshold_str.lower() in ["none", "any occurrence"]:
        return {
            "operator": None,
            "threshold": None,
            "units": None,
            "duration_minutes": 0,
            "is_event": True,
        }

    result = {
        "operator": "GREATER_THAN",
        "threshold": 0,
        "units": "RAW",
        "duration_minutes": 5,
        "is_event": False,
    }

    # Handle simple duration format like "15 minutes" or "24 hours"
    simple_duration = re.match(r"^(\d+)\s*(minutes?|hours?|h|m)$", threshold_str.strip(), re.IGNORECASE)
    if simple_duration:
        value = int(simple_duration.group(1))
        unit = simple_duration.group(2).lower()
        if unit.startswith("h"):
            value *= 60
        result["duration_minutes"] = value
        result["is_event"] = True
        return result

    # Parse operator
    if threshold_str.startswith("<"):
        result["operator"] = "LESS_THAN"
        threshold_str = threshold_str[1:].strip()
    elif threshold_str.startswith(">"):
        result["operator"] = "GREATER_THAN"
        threshold_str = threshold_str[1:].strip()

    # Split by "for" to get threshold and duration
    parts = re.split(r"\s+for\s+", threshold_str, flags=re.IGNORECASE)
    threshold_part = parts[0].strip()
    duration_part = parts[1].strip() if len(parts) > 1 else "5 minutes"

    # Parse threshold value and units
    # Handle special cases like "0-10", "10+"
    if "-" in threshold_part and not threshold_part.startswith("-"):
        # Range like "0-10" - use the lower bound to differentiate from "10+"
        range_match = re.match(r"(\d+)-(\d+)", threshold_part)
        if range_match:
            result["threshold"] = int(range_match.group(1))
    elif threshold_part.endswith("+"):
        # Like "10+"
        result["threshold"] = int(threshold_part.rstrip("+"))
    else:
        # Parse value with unit suffix
        value_match = re.match(
            r"([\d.]+)\s*(ms|s|seconds?|h|hours?|GB|MB|KB|%|/second)?",
            threshold_part,
            re.IGNORECASE
        )
        if value_match:
            value = float(value_match.group(1))
            unit = (value_match.group(2) or "").lower()

            if unit == "ms":
                result["threshold"] = value
                result["units"] = "MILLISECONDS"
            elif unit in ["s", "seconds", "second"]:
                result["threshold"] = value
                result["units"] = "SECONDS"
            elif unit in ["h", "hours", "hour"]:
                result["threshold"] = value * 3600  # Convert to seconds
                result["units"] = "SECONDS"
            elif unit == "gb":
                result["threshold"] = value * 1024 * 1024 * 1024
                result["units"] = "BYTES"
            elif unit == "mb":
                result["threshold"] = value * 1024 * 1024
                result["units"] = "BYTES"
            elif unit == "kb":
                result["threshold"] = value * 1024
                result["units"] = "BYTES"
            elif unit == "%":
                result["threshold"] = value
                result["units"] = "RAW"
            elif unit == "/second":
                result["threshold"] = value
                result["units"] = "RAW"
            else:
                result["threshold"] = value
                result["units"] = "RAW"

    # Parse duration
    duration_match = re.match(r"(\d+)\s*(minutes?|hours?|h|m)", duration_part, re.IGNORECASE)
    if duration_match:
        duration_value = int(duration_match.group(1))
        duration_unit = duration_match.group(2).lower()
        if duration_unit.startswith("h"):
            duration_value *= 60
        result["duration_minutes"] = duration_value

    return result


def create_alert_config(
    alert_name: str,
    threshold_info: dict[str, Any],
    priority: str,
    mapping: dict[str, Any],
    notification_emails: list[str],
    notification_type: str = "GROUP",
) -> dict[str, Any]:
    """Create an Ops Manager alert configuration JSON structure."""
    config: dict[str, Any] = {
        "eventTypeName": mapping["event_type"],
        "enabled": True,
        "matchers": [],
    }

    # Add typeName if specified (for backup/agent alerts)
    if mapping.get("type_name"):
        config["typeName"] = mapping["type_name"]

    # Add notifications
    notifications = []

    # Group notification (for Ops Manager users)
    if notification_type == "GROUP":
        notifications.append({
            "typeName": "GROUP",
            "intervalMin": 60,
            "delayMin": threshold_info.get("duration_minutes", 0),
            "emailEnabled": True,
            "smsEnabled": False,
        })

    # Email notifications
    for email in notification_emails:
        if email:
            notifications.append({
                "typeName": "EMAIL",
                "intervalMin": 60,
                "delayMin": threshold_info.get("duration_minutes", 0),
                "emailAddress": email,
            })

    config["notifications"] = notifications

    # For metric-based alerts
    if mapping.get("metric_name"):
        metric_units = mapping.get("units", "RAW")

        # Use units from threshold parsing if available and meaningful
        if threshold_info.get("units") and threshold_info["units"] != "RAW":
            metric_units = threshold_info["units"]

        config["metricThreshold"] = {
            "metricName": mapping["metric_name"],
            "operator": threshold_info.get("operator", "GREATER_THAN"),
            "threshold": threshold_info.get("threshold", 0),
            "units": metric_units,
            "mode": "AVERAGE",
        }

    # For event-based alerts with duration threshold
    elif mapping.get("uses_threshold") and not threshold_info.get("is_event"):
        if mapping["event_type"] == "REPLICATION_OPLOG_WINDOW_RUNNING_OUT":
            # Oplog window uses different threshold structure
            # Convert hours to the format Ops Manager expects
            threshold_val = threshold_info.get("threshold", 24)
            if threshold_info.get("units") == "SECONDS":
                threshold_val = threshold_val / 3600  # Convert seconds to hours
            config["threshold"] = {
                "operator": threshold_info.get("operator", "LESS_THAN"),
                "threshold": int(threshold_val) if threshold_val >= 1 else 1,
                "units": "HOURS",
            }
        elif mapping["event_type"] == "TOO_MANY_UNHEALTHY_MEMBERS":
            # Unhealthy members count threshold
            config["threshold"] = {
                "operator": threshold_info.get("operator", "GREATER_THAN"),
                "threshold": int(threshold_info.get("threshold", 1)),
                "units": "RAW",
            }

    # Handle HOST_DOWN and NO_PRIMARY duration thresholds separately
    if mapping["event_type"] in ["HOST_DOWN", "NO_PRIMARY"] and mapping.get("uses_threshold"):
        config["threshold"] = {
            "operator": "GREATER_THAN",
            "threshold": threshold_info.get("duration_minutes", 5),
            "units": "MINUTES",
        }

    return config


def read_excel_file(excel_path: Path, logger: logging.Logger) -> list[dict[str, Any]]:
    """Read alert configurations from Excel file."""
    if not excel_path.exists():
        logger.error(f"Excel file not found: {excel_path}")
        sys.exit(1)

    try:
        wb = openpyxl.load_workbook(excel_path)
        sheet = wb.active
    except Exception as e:
        logger.error(f"Failed to read Excel file: {e}")
        sys.exit(1)

    alerts = []
    for row in sheet.iter_rows(min_row=2, values_only=True):
        if not row[0]:  # Skip empty rows
            continue

        alert = {
            "name": row[0],
            "category": row[1] if len(row) > 1 else None,
            "low_threshold": row[2] if len(row) > 2 else None,
            "high_threshold": row[3] if len(row) > 3 else None,
            "description": row[4] if len(row) > 4 else None,
        }
        alerts.append(alert)

    logger.info(f"Found {len(alerts)} alert definitions")
    return alerts


def generate_json_files(
    alerts: list[dict[str, Any]],
    output_dir: Path,
    notification_emails: list[str],
    logger: logging.Logger,
) -> list[dict[str, Any]]:
    """Generate JSON configuration files for each alert."""
    output_dir.mkdir(parents=True, exist_ok=True)
    generated_files = []
    file_index = 1

    # Track created alerts to prevent duplicates
    # Key: (event_type, metric_name, threshold) -> prevents exact duplicates
    created_alerts: set[tuple[str, Optional[str], Optional[float], Optional[int]]] = set()

    for alert in alerts:
        name = alert["name"]
        mapping = ALERT_MAPPINGS.get(name)

        if not mapping:
            logger.warning(f"No mapping found for alert: {name}")
            continue

        # Skip alerts marked as unsupported
        if mapping.get("skip"):
            logger.info(f"  Skipping unsupported alert: {name}")
            continue

        # Generate low priority alert if threshold exists
        if alert["low_threshold"] and str(alert["low_threshold"]).lower() not in ["none", ""]:
            threshold_info = parse_threshold(str(alert["low_threshold"]))
            config = create_alert_config(
                name,
                threshold_info,
                "low",
                mapping,
                notification_emails,
            )

            # Check for duplicate: same event_type, metric_name, and threshold/duration
            metric_name = mapping.get("metric_name")
            threshold_val = threshold_info.get("threshold")
            duration_val = threshold_info.get("duration_minutes")
            alert_key = (mapping["event_type"], metric_name, threshold_val, duration_val)

            if alert_key in created_alerts:
                logger.warning(f"  Skipping duplicate alert: {name} (Low Priority) - same as existing alert")
            else:
                created_alerts.add(alert_key)

                filename = f"{file_index:02d}_{name.lower().replace(' ', '_').replace(':', '').replace('/', '_')}_low.json"
                filepath = output_dir / filename

                with open(filepath, "w") as f:
                    json.dump(config, f, indent=2)

                generated_files.append({
                    "name": f"{name} (Low Priority)",
                    "path": filepath,
                    "config": config,
                })
                logger.info(f"  Generated: {filename}")
                file_index += 1

        # Generate high priority alert if threshold exists and is different
        if (
            alert["high_threshold"]
            and str(alert["high_threshold"]).lower() not in ["none", ""]
            and alert["high_threshold"] != alert["low_threshold"]
        ):
            threshold_info = parse_threshold(str(alert["high_threshold"]))
            config = create_alert_config(
                name,
                threshold_info,
                "high",
                mapping,
                notification_emails,
            )

            # Check for duplicate
            metric_name = mapping.get("metric_name")
            threshold_val = threshold_info.get("threshold")
            duration_val = threshold_info.get("duration_minutes")
            alert_key = (mapping["event_type"], metric_name, threshold_val, duration_val)

            if alert_key in created_alerts:
                logger.warning(f"  Skipping duplicate alert: {name} (High Priority) - same as existing alert")
            else:
                created_alerts.add(alert_key)

                filename = f"{file_index:02d}_{name.lower().replace(' ', '_').replace(':', '').replace('/', '_')}_high.json"
                filepath = output_dir / filename

                with open(filepath, "w") as f:
                    json.dump(config, f, indent=2)

                generated_files.append({
                    "name": f"{name} (High Priority)",
                    "path": filepath,
                    "config": config,
                })
                logger.info(f"  Generated: {filename}")
                file_index += 1

    return generated_files


def load_tracked_alerts(script_dir: Path, project_id: str) -> list[str]:
    """Load list of automation-created alert IDs from tracking file."""
    tracking_file = script_dir / ALERT_TRACKING_FILE
    if not tracking_file.exists():
        return []

    try:
        with open(tracking_file) as f:
            data = json.load(f)
            return data.get(project_id, [])
    except (json.JSONDecodeError, IOError):
        return []


def save_tracked_alerts(script_dir: Path, project_id: str, alert_ids: list[str]) -> None:
    """Save list of automation-created alert IDs to tracking file."""
    tracking_file = script_dir / ALERT_TRACKING_FILE

    # Load existing data
    data = {}
    if tracking_file.exists():
        try:
            with open(tracking_file) as f:
                data = json.load(f)
        except (json.JSONDecodeError, IOError):
            data = {}

    # Update with new IDs
    existing = set(data.get(project_id, []))
    existing.update(alert_ids)
    data[project_id] = list(existing)

    with open(tracking_file, "w") as f:
        json.dump(data, f, indent=2)


def create_alerts(
    client: OpsManagerClient,
    generated_files: list[dict[str, Any]],
    project_id: str,
    dry_run: bool,
    script_dir: Path,
    logger: logging.Logger,
) -> tuple[int, int, list[dict[str, str]]]:
    """Create alerts using Ops Manager API."""
    success_count = 0
    failure_count = 0
    failures = []
    created_alert_ids = []

    total = len(generated_files)

    for i, file_info in enumerate(generated_files, 1):
        name = file_info["name"]
        config = file_info["config"]

        logger.info(f"\n[{i}/{total}] Creating alert: {name}")

        if dry_run:
            logger.info("  SKIPPED (dry run mode)")
            success_count += 1
            continue

        try:
            response = client.create_alert_config(project_id, config)
            alert_id = response.get("id", "unknown")
            logger.info(f"  SUCCESS - Alert ID: {alert_id}")
            if alert_id != "unknown":
                created_alert_ids.append(alert_id)
            success_count += 1

        except Exception as e:
            error_msg = str(e)
            logger.error(f"  FAILED - Error: {error_msg}")
            failures.append({"name": name, "error": error_msg})
            failure_count += 1

    # Save created alert IDs for tracking
    if created_alert_ids:
        save_tracked_alerts(script_dir, project_id, created_alert_ids)
        logger.info(f"\nTracked {len(created_alert_ids)} alert IDs in {ALERT_TRACKING_FILE}")

    return success_count, failure_count, failures


def delete_existing_alerts(
    client: OpsManagerClient,
    project_id: str,
    script_dir: Path,
    logger: logging.Logger,
) -> bool:
    """Delete only automation-created alerts from the project."""
    tracked_ids = load_tracked_alerts(script_dir, project_id)

    if not tracked_ids:
        logger.info("No automation-created alerts tracked for this project.")
        return True

    logger.info(f"\nFound {len(tracked_ids)} tracked automation-created alerts. Deleting...")

    deleted_ids = []
    for alert_id in tracked_ids:
        try:
            if client.delete_alert_config(project_id, alert_id):
                logger.info(f"  Deleted alert: {alert_id}")
                deleted_ids.append(alert_id)
        except Exception as e:
            if "NOT_FOUND" in str(e) or "404" in str(e):
                logger.info(f"  Alert {alert_id} already deleted or not found")
                deleted_ids.append(alert_id)
            else:
                logger.warning(f"  Failed to delete alert {alert_id}: {e}")

    # Update tracking file to remove deleted IDs
    remaining = [aid for aid in tracked_ids if aid not in deleted_ids]
    tracking_file = script_dir / ALERT_TRACKING_FILE

    if tracking_file.exists():
        try:
            with open(tracking_file) as f:
                data = json.load(f)
            data[project_id] = remaining
            with open(tracking_file, "w") as f:
                json.dump(data, f, indent=2)
        except (json.JSONDecodeError, IOError):
            pass

    return True


def delete_all_alerts(
    client: OpsManagerClient,
    project_id: str,
    logger: logging.Logger,
) -> bool:
    """Delete ALL alerts from the project (including default alerts)."""
    logger.info("\nFetching all alerts...")

    try:
        alerts = client.list_alert_configs(project_id)

        if not alerts:
            logger.info("No alerts found.")
            return True

        logger.info(f"Found {len(alerts)} alerts. Deleting ALL...")

        for alert in alerts:
            alert_id = alert.get("id")
            if not alert_id:
                continue

            try:
                if client.delete_alert_config(project_id, alert_id):
                    logger.info(f"  Deleted alert: {alert_id}")
            except Exception as e:
                logger.warning(f"  Failed to delete alert {alert_id}: {e}")

        return True

    except Exception as e:
        logger.error(f"Error deleting alerts: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(
        description="Create MongoDB Ops Manager alerts from Excel configuration",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Dry run to generate JSON files only
  python create_opsmanager_alerts.py --base-url https://opsmanager.example.com:8080 \\
    --public-key YOUR_PUBLIC_KEY --private-key YOUR_PRIVATE_KEY \\
    --project-id YOUR_PROJECT_ID --dry-run

  # Create alerts with custom notification email
  python create_opsmanager_alerts.py --base-url https://opsmanager.example.com:8080 \\
    --public-key YOUR_PUBLIC_KEY --private-key YOUR_PRIVATE_KEY \\
    --project-id YOUR_PROJECT_ID --notification-email alerts@company.com

  # Delete existing alerts before creating new ones
  python create_opsmanager_alerts.py --base-url https://opsmanager.example.com:8080 \\
    --public-key YOUR_PUBLIC_KEY --private-key YOUR_PRIVATE_KEY \\
    --project-id YOUR_PROJECT_ID --delete-existing

Environment variables (alternative to command line args):
  OPS_MANAGER_BASE_URL - Base URL for Ops Manager
  OPS_MANAGER_PUBLIC_KEY - API public key
  OPS_MANAGER_PRIVATE_KEY - API private key
        """,
    )

    parser.add_argument(
        "--base-url",
        default=os.environ.get("OPS_MANAGER_BASE_URL"),
        help="Ops Manager base URL (e.g., https://opsmanager.example.com:8080/api/public/v1.0)",
    )
    parser.add_argument(
        "--public-key",
        default=os.environ.get("OPS_MANAGER_PUBLIC_KEY"),
        help="Ops Manager API public key",
    )
    parser.add_argument(
        "--private-key",
        default=os.environ.get("OPS_MANAGER_PRIVATE_KEY"),
        help="Ops Manager API private key",
    )
    parser.add_argument(
        "--project-id",
        required=True,
        help="MongoDB Ops Manager Project/Group ID",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Generate JSON files but don't create alerts via API",
    )
    parser.add_argument(
        "--excel-file",
        default="opsmanager_alert_configurations.xlsx",
        help="Path to Excel file (default: opsmanager_alert_configurations.xlsx)",
    )
    parser.add_argument(
        "--output-dir",
        default="./alerts",
        help="Directory for JSON files (default: ./alerts)",
    )
    parser.add_argument(
        "--notification-email",
        action="append",
        default=[],
        help="Email address(es) for alert notifications (can be specified multiple times)",
    )
    parser.add_argument(
        "--delete-existing",
        action="store_true",
        help="Delete automation-created alerts before creating new ones",
    )
    parser.add_argument(
        "--delete-all",
        action="store_true",
        help="Delete ALL alerts (including default alerts) before creating new ones",
    )
    parser.add_argument(
        "--log-dir",
        default="./logs",
        help="Directory for log files (default: ./logs)",
    )

    args = parser.parse_args()

    # Validate required arguments
    if not args.dry_run:
        if not args.base_url:
            print("ERROR: --base-url is required (or set OPS_MANAGER_BASE_URL)")
            sys.exit(1)
        if not args.public_key:
            print("ERROR: --public-key is required (or set OPS_MANAGER_PUBLIC_KEY)")
            sys.exit(1)
        if not args.private_key:
            print("ERROR: --private-key is required (or set OPS_MANAGER_PRIVATE_KEY)")
            sys.exit(1)

    # Set up paths
    script_dir = Path(__file__).parent
    excel_path = Path(args.excel_file)
    if not excel_path.is_absolute():
        excel_path = script_dir / excel_path

    output_dir = Path(args.output_dir)
    if not output_dir.is_absolute():
        output_dir = script_dir / output_dir

    log_dir = Path(args.log_dir)
    if not log_dir.is_absolute():
        log_dir = script_dir / log_dir

    # Set up logging
    logger = setup_logging(log_dir)

    # Print banner
    print(BANNER)
    logger.info(f"Project ID: {args.project_id}")
    logger.info(f"Reading Excel file: {excel_path}")

    # Create API client
    client = None
    if not args.dry_run:
        # Ensure base URL includes API path
        base_url = args.base_url
        if not base_url.endswith("/api/public/v1.0"):
            base_url = base_url.rstrip("/") + "/api/public/v1.0"

        client = OpsManagerClient(
            base_url=base_url,
            public_key=args.public_key,
            private_key=args.private_key,
            logger=logger,
        )

        logger.info(f"Connecting to Ops Manager: {base_url}")

        # Test connection
        try:
            project = client.get_project(args.project_id)
            logger.info(f"Connected to project: {project.get('name', args.project_id)}")
        except Exception as e:
            logger.error(f"Failed to connect to Ops Manager: {e}")
            sys.exit(1)

    # Delete ALL alerts if requested
    if args.delete_all and not args.dry_run:
        confirm = input("\nWARNING: This will delete ALL alerts including default alerts!\nType 'delete all' to confirm: ")
        if confirm.lower() == "delete all":
            if not delete_all_alerts(client, args.project_id, logger):
                logger.error("Failed to delete alerts.")
                sys.exit(1)
            logger.info("\nAll alerts deleted.")
        else:
            logger.info("Cancelled.")
        sys.exit(0)

    # Delete existing automation-created alerts if requested
    if args.delete_existing and not args.dry_run:
        confirm = input("\nDelete automation-created alerts? (Default alerts will NOT be deleted) (yes/no): ")
        if confirm.lower() == "yes":
            if not delete_existing_alerts(client, args.project_id, script_dir, logger):
                logger.error("Failed to delete existing alerts.")
                sys.exit(1)
            logger.info("\nAutomation-created alerts deleted.")
        else:
            logger.info("Cancelled.")
        sys.exit(0)

    # Read Excel file
    alerts = read_excel_file(excel_path, logger)

    # Generate JSON files
    logger.info("\nGenerating JSON configurations...")
    generated_files = generate_json_files(
        alerts,
        output_dir,
        args.notification_email,
        logger,
    )

    if not generated_files:
        logger.error("No alert configurations were generated.")
        sys.exit(1)

    logger.info(f"\nGenerated {len(generated_files)} alert configuration files")

    # Create alerts
    logger.info("\nCreating alerts via Ops Manager API...")
    if args.dry_run:
        logger.info("(DRY RUN MODE - No alerts will be created)")

    success_count, failure_count, failures = create_alerts(
        client,
        generated_files,
        args.project_id,
        args.dry_run,
        script_dir,
        logger,
    )

    # Print summary
    summary = f"""
================================================================================
  SUMMARY
================================================================================
Total Alerts Attempted: {len(generated_files)}
Successful: {success_count}
Failed: {failure_count}
"""
    logger.info(summary)

    if failures:
        logger.info("Failed Alerts:")
        for failure in failures:
            logger.info(f"  - {failure['name']}: {failure['error']}")

    log_files = list(log_dir.glob("alert_creation_*.log"))
    if log_files:
        latest_log = max(log_files, key=lambda p: p.stat().st_mtime)
        logger.info(f"\nLog file: {latest_log}")

    print("=" * 80)

    # Exit with appropriate code
    sys.exit(1 if failure_count > 0 else 0)


if __name__ == "__main__":
    main()
