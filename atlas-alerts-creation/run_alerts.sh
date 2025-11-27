#!/bin/bash
#
# MongoDB Atlas Alert Configuration Wrapper Script
#
# This script checks prerequisites and runs the Python alert creation script.
# AUTOMATED ALERTS - NOT DEFAULT ATLAS ALERTS
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON_SCRIPT="$SCRIPT_DIR/create_atlas_alerts.py"
VENV_DIR="$SCRIPT_DIR/.venv"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "================================================================================"
echo "  MongoDB Atlas Alert Configuration Script"
echo "  AUTOMATED ALERTS - NOT DEFAULT ATLAS ALERTS"
echo "================================================================================"
echo ""

# Function to print error messages
error() {
    echo -e "${RED}ERROR: $1${NC}" >&2
}

# Function to print success messages
success() {
    echo -e "${GREEN}$1${NC}"
}

# Function to print warning messages
warning() {
    echo -e "${YELLOW}WARNING: $1${NC}"
}

# Check for Python 3
echo "Checking prerequisites..."
echo ""

if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version 2>&1)
    success "✓ Python 3 found: $PYTHON_VERSION"
else
    error "Python 3 is not installed."
    echo "  Please install Python 3.8 or higher."
    echo "  - macOS: brew install python3"
    echo "  - Ubuntu/Debian: sudo apt install python3"
    exit 1
fi

# Check Python version is 3.8+
PYTHON_MAJOR=$(python3 -c 'import sys; print(sys.version_info.major)')
PYTHON_MINOR=$(python3 -c 'import sys; print(sys.version_info.minor)')

if [ "$PYTHON_MAJOR" -lt 3 ] || ([ "$PYTHON_MAJOR" -eq 3 ] && [ "$PYTHON_MINOR" -lt 8 ]); then
    error "Python 3.8 or higher is required. Found: $PYTHON_MAJOR.$PYTHON_MINOR"
    exit 1
fi

# Check for Atlas CLI
if command -v atlas &> /dev/null; then
    ATLAS_VERSION=$(atlas --version 2>&1 | head -n1)
    success "✓ Atlas CLI found: $ATLAS_VERSION"
else
    error "MongoDB Atlas CLI is not installed."
    echo ""
    echo "  Install Atlas CLI:"
    echo "  - macOS: brew install mongodb-atlas-cli"
    echo "  - Linux: See https://www.mongodb.com/docs/atlas/cli/current/install-atlas-cli/"
    echo "  - Download: https://www.mongodb.com/try/download/atlascli"
    exit 1
fi

# Check Atlas CLI authentication (only if not doing dry-run)
DRY_RUN=false
for arg in "$@"; do
    if [ "$arg" == "--dry-run" ]; then
        DRY_RUN=true
        break
    fi
done

if [ "$DRY_RUN" = false ]; then
    echo ""
    echo "Checking Atlas CLI authentication..."

    if atlas auth whoami &> /dev/null; then
        success "✓ Atlas CLI is authenticated"
    else
        error "Atlas CLI is not authenticated."
        echo ""
        echo "  Run: atlas auth login"
        echo "  Then select: UserAccount, ServiceAccount, or APIKeys"
        exit 1
    fi
fi

# Set up virtual environment and install dependencies
echo ""
echo "Setting up Python environment..."

if [ ! -d "$VENV_DIR" ]; then
    echo "Creating virtual environment..."
    python3 -m venv "$VENV_DIR"
fi

# Activate virtual environment
source "$VENV_DIR/bin/activate"

# Check/install required packages
PACKAGES_NEEDED=false

if ! python3 -c "import openpyxl" 2>/dev/null; then
    PACKAGES_NEEDED=true
fi

if [ "$PACKAGES_NEEDED" = true ]; then
    echo "Installing required Python packages..."
    pip install --quiet --upgrade pip
    pip install --quiet openpyxl
    success "✓ Python packages installed"
else
    success "✓ Python packages already installed"
fi

# Check if Excel file exists
EXCEL_FILE="$SCRIPT_DIR/atlas_alert_configurations.xlsx"
CUSTOM_EXCEL=false

for i in "$@"; do
    case $i in
        --excel-file=*)
            EXCEL_FILE="${i#*=}"
            CUSTOM_EXCEL=true
            shift
            ;;
        --excel-file)
            # Next argument is the file path
            CUSTOM_EXCEL=true
            ;;
    esac
done

if [ ! -f "$EXCEL_FILE" ] && [ "$CUSTOM_EXCEL" = false ]; then
    warning "Default Excel file not found: $EXCEL_FILE"
    echo "  Use --excel-file to specify a custom location"
fi

# Check if Python script exists
if [ ! -f "$PYTHON_SCRIPT" ]; then
    error "Python script not found: $PYTHON_SCRIPT"
    exit 1
fi

# Run the Python script
echo ""
echo "================================================================================"
echo ""

python3 "$PYTHON_SCRIPT" "$@"
EXIT_CODE=$?

# Deactivate virtual environment
deactivate

exit $EXIT_CODE
