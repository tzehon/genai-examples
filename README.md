# research

Research projects, mostly carried out by LLM tools.

<!--[[[cog
import os
import subprocess
from pathlib import Path

MODEL = "claude-sonnet-4.5"

def get_first_commit_date(folder):
    result = subprocess.run(
        ["git", "log", "--diff-filter=A", "--follow", "--format=%aI", "--", folder],
        capture_output=True, text=True
    )
    dates = result.stdout.strip().split('\n')
    return dates[-1] if dates and dates[-1] else None

def get_summary(folder):
    summary_file = Path(folder) / "_summary.md"
    if summary_file.exists():
        return summary_file.read_text().strip()

    readme_file = Path(folder) / "README.md"
    if not readme_file.exists():
        return f"Research project in `{folder}`"

    # Generate summary using LLM
    result = subprocess.run(
        ["llm", "-m", MODEL],
        input=f"Summarize this research project concisely. Write just 1 paragraph (3-5 sentences) followed by an optional short bullet list if there are key findings. Vary your opening - don't start with 'This report' or 'This research'. Include 1-2 links to key tools/projects mentioned.\n\n{readme_file.read_text()}",
        capture_output=True, text=True
    )
    summary = result.stdout.strip()
    if summary:
        summary_file.write_text(summary)
    return summary or f"Research project in `{folder}`"

def get_repo_url():
    result = subprocess.run(
        ["git", "remote", "get-url", "origin"],
        capture_output=True, text=True
    )
    url = result.stdout.strip()
    if url.startswith("git@github.com:"):
        url = url.replace("git@github.com:", "https://github.com/").replace(".git", "")
    elif url.endswith(".git"):
        url = url[:-4]
    return url

# Get all project directories (exclude hidden dirs and files)
projects = []
for item in Path(".").iterdir():
    if item.is_dir() and not item.name.startswith("."):
        date = get_first_commit_date(item.name)
        if date:
            projects.append((date, item.name))

# Sort by date, newest first
projects.sort(reverse=True)

repo_url = get_repo_url()

for date, folder in projects:
    date_str = date[:10] if date else "unknown"
    print(f"### [{folder}]({repo_url}/tree/main/{folder}) ({date_str})\n")
    print(get_summary(folder))
    print()
]]]-->
### [mongodb-failover-tester](https://github.com/tzehon/research/tree/main/mongodb-failover-tester) (2025-11-28)

MongoDB drivers come configured with robust failover defaults—30-second timeouts and automatic retries—that handle replica set elections seamlessly without any configuration. This [MongoDB Atlas](https://www.mongodb.com/atlas) failover testing application proves this by comparing two real [MongoClient](https://mongodb.github.io/node-mongodb-native/) instances side-by-side during live Atlas-triggered failovers: one using driver defaults succeeds with zero failures, while another with overridden settings (2-second timeout, retries disabled) fails repeatedly during the brief election window. The full-stack app uses three separate client connections—two for testing different configurations and one for monitoring cluster topology—to demonstrate that elections typically complete in under 10 seconds, well within the default 30-second safety margin, but faster than poorly configured clients can handle.

**Key findings:**
- **Resilient config** (defaults): `retryWrites: true`, `retryReads: true`, `serverSelectionTimeoutMS: 30000` → Zero failures
- **Fragile config** (bad overrides): `retryWrites: false`, `retryReads: false`, `serverSelectionTimeoutMS: 2000` → Many failures
- Elections complete in <10s, but 30s default provides safety margin for network variability
- Modern drivers (4.2+ for writes, 6.0+ for reads) handle failover automatically—no code changes needed

### [ops-manager-alerts-creation](https://github.com/tzehon/research/tree/main/ops-manager-alerts-creation) (2025-11-28)

Automation script to create MongoDB Ops Manager alerts from an Excel configuration file using the Ops Manager API. Uses HTTP Digest authentication with API keys to directly call the Ops Manager API. Includes 27 pre-configured alerts covering replication, host health, disk I/O, backup agents, and monitoring agents. Adapted from the Atlas alert automation tool with Ops Manager-specific event types.

### [atlas-alerts-creation](https://github.com/tzehon/research/tree/main/atlas-alerts-creation) (2025-11-27)

A Python automation tool streamlines the deployment of [MongoDB Atlas](https://www.mongodb.com/atlas) monitoring alerts by converting Excel configurations into alerts via the [Atlas CLI](https://www.mongodb.com/docs/atlas/cli/current/). The tool addresses the time-consuming manual process of implementing MongoDB's recommended alert configurations across multiple projects, which normally requires cross-referencing documentation, configuring 20+ alerts individually, and repeating the process for each Atlas project. Users define alert configurations once in a spreadsheet (metrics, thresholds, notification preferences), then deploy them consistently across any number of projects in seconds using a simple bash wrapper script.

**Key features:**
- **Automated mapping**: Converts alert names to Atlas event types and metric names (e.g., "Disk IOPS", "Replication Lag", "Host Down")
- **Flexible thresholds**: Supports multiple formats (percentage, time-based, size-based) with separate low/high priority alerts
- **Safe operations**: Dry-run mode, duplicate detection, and selective deletion (automation-created alerts only vs. all alerts)
- **Tracking**: Maintains `.automation_alert_ids.json` to distinguish automation-created alerts from default Atlas alerts

### [invoice_processor](https://github.com/tzehon/research/tree/main/invoice_processor) (2025-11-27)

An intelligent PDF invoice processor leverages [Streamlit](https://streamlit.io/) to automatically extract, classify, and query financial documents using a sophisticated multi-stage approach. The system employs the `paraphrase-multilingual-mpnet-base-v2` model for 768-dimensional vector embeddings, [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) Vector Search for similarity matching (0.85 threshold), and Claude Sonnet 4.5 for metadata extraction and merchant verification. As the system processes documents over time, it builds an intelligent merchant database that recognizes variations and synonyms across 50+ languages—automatically linking "Grab Singapore Pte Ltd," "Grab SG," and even cross-lingual equivalents to the same canonical merchant entry.

**Key capabilities:**
- **Smart merchant classification**: Combines exact matching, vector similarity, and LLM verification to reduce duplicates
- **Natural language querying**: Converts plain English queries like "Show Grab receipts from last month" into MongoDB aggregation pipelines
- **Multilingual support**: Handles English, Chinese, and 48+ other languages with semantic understanding across translations
- **Cost-efficient**: Free MongoDB M0 tier, ~$0.01-0.05 per document processing with Anthropic API

<!--[[[end]]]-->
