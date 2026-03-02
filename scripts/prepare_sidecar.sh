#!/bin/bash
set -e

# Configuration
PYTHON_VERSION="3.13.12"
BUILD_TAG="20260203"
PLATFORM="aarch64-apple-darwin"
URL="https://github.com/astral-sh/python-build-standalone/releases/download/${BUILD_TAG}/cpython-${PYTHON_VERSION}+${BUILD_TAG}-${PLATFORM}-install_only.tar.gz"

RESOURCE_DIR="electron/resources"
BIN_DIR="${RESOURCE_DIR}/bin"
SITE_PACKAGES_DIR="${RESOURCE_DIR}/site-packages"

echo "🚀 Preparing Sidecar Resources..."

# 1. Create directories
mkdir -p "${BIN_DIR}"
mkdir -p "${SITE_PACKAGES_DIR}"
mkdir -p "electron/build"

# 2. Download Portable Python if not exists
if [ ! -f "${BIN_DIR}/python-runtime/bin/python3" ]; then
    echo "📥 Downloading Portable Python (${PYTHON_VERSION})..."
    curl -L "${URL}" -o "python-standalone.tar.gz"
    mkdir -p "${BIN_DIR}/python-runtime"
    tar -xzf "python-standalone.tar.gz" -C "${BIN_DIR}/python-runtime" --strip-components=1
    rm "python-standalone.tar.gz"
    echo "✅ Python downloaded."
else
    echo "ℹ️ Portable Python already exists."
fi

# 3. Export site-packages (excluding heavy ones we stub)
echo "📦 Exporting site-packages from .venv..."
# Prune torch-related stuff to save space
# We use 'uv pip install' to a temporary directory to get a clean set of dependencies
# OR we just copy the current .venv/lib/python3.13/site-packages
# For now, let's just copy and exclude torch
rsync -av --progress .venv/lib/python3.13/site-packages/ "${SITE_PACKAGES_DIR}/" \
    --exclude "torch*" \
    --exclude "torchaudio*" \
    --exclude "nvidia*" \
    --exclude "__pycache__"

# 4. Create Stub Torch to satisfy imports
echo "stub" > "${SITE_PACKAGES_DIR}/torch_stub_marker"
mkdir -p "${SITE_PACKAGES_DIR}/torch"
touch "${SITE_PACKAGES_DIR}/torch/__init__.py"
mkdir -p "${SITE_PACKAGES_DIR}/torchaudio"
touch "${SITE_PACKAGES_DIR}/torchaudio/__init__.py"

echo "✨ Sidecar preparation complete!"
echo "Next: run 'pnpm -C electron install' and 'pnpm -C electron package'"
