#!/bin/bash
#
# MongoDB Ops Manager Alert Configuration Script Runner
#
# This script sets up the Python environment and runs the alert configuration tool.
#
# Usage:
#   ./run_alerts.sh --project-id YOUR_PROJECT_ID [options]
#
# For help:
#   ./run_alerts.sh --help

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="$SCRIPT_DIR/.venv"
PYTHON_SCRIPT="$SCRIPT_DIR/create_opsmanager_alerts.py"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

echo_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

echo_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check Python version
check_python() {
    if command -v python3 &> /dev/null; then
        PYTHON_CMD="python3"
    elif command -v python &> /dev/null; then
        PYTHON_CMD="python"
    else
        echo_error "Python is not installed. Please install Python 3.8 or higher."
        exit 1
    fi

    # Check version
    PYTHON_VERSION=$($PYTHON_CMD -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
    MAJOR=$(echo $PYTHON_VERSION | cut -d. -f1)
    MINOR=$(echo $PYTHON_VERSION | cut -d. -f2)

    if [ "$MAJOR" -lt 3 ] || ([ "$MAJOR" -eq 3 ] && [ "$MINOR" -lt 8 ]); then
        echo_error "Python 3.8 or higher is required. Found: Python $PYTHON_VERSION"
        exit 1
    fi

    echo_info "Using Python $PYTHON_VERSION"
}

# Setup virtual environment
setup_venv() {
    if [ ! -d "$VENV_DIR" ]; then
        echo_info "Creating virtual environment..."
        $PYTHON_CMD -m venv "$VENV_DIR"
    fi

    # Activate venv
    source "$VENV_DIR/bin/activate"

    # Install/upgrade dependencies
    echo_info "Installing dependencies..."
    pip install --quiet --upgrade pip
    pip install --quiet -r "$SCRIPT_DIR/requirements.txt"
}

# Main
main() {
    check_python
    setup_venv

    # Run the Python script with all arguments
    python "$PYTHON_SCRIPT" "$@"
}

main "$@"
