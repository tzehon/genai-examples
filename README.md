# research

Research projects, mostly carried out by LLM tools.

<!--[[[cog
import cog
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
        input=f"Summarize this research project concisely. Write just 1 paragraph (3-5 sentences). Vary your opening - don't start with 'This report' or 'This research'.\n\n{readme_file.read_text()}",
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
    cog.outl(f"## [{folder}]({repo_url}/tree/main/{folder}) ({date_str})\n")
    cog.outl(get_summary(folder))
    cog.outl()
]]]-->
<!--[[[end]]]-->
