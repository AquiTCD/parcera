#!/bin/bash
set -e

# Configuration
# Updated to match project Python version and latest standalone build
PYTHON_VERSION="3.13.12"
BUILD_TAG="20260203"
PLATFORM="aarch64-apple-darwin"
URL="https://github.com/astral-sh/python-build-standalone/releases/download/${BUILD_TAG}/cpython-${PYTHON_VERSION}+${BUILD_TAG}-${PLATFORM}-install_only.tar.gz"

RESOURCE_DIR="electron/resources"
BIN_DIR="${RESOURCE_DIR}/bin"
SITE_PACKAGES_DIR="${RESOURCE_DIR}/site-packages"

echo "🚀 Preparing Sidecar Resources (Python ${PYTHON_VERSION})..."

# 1. Create directories
mkdir -p "${BIN_DIR}"
mkdir -p "${SITE_PACKAGES_DIR}"
mkdir -p "electron/build"

# 2. Download Portable Python if not exists (or if version mismatch)
# We check the version file if it exists to ensure we have the right one
CURRENT_VER=""
if [ -f "${BIN_DIR}/python-runtime/BIN_VERSION" ]; then
    CURRENT_VER=$(cat "${BIN_DIR}/python-runtime/BIN_VERSION")
fi

if [ "${CURRENT_VER}" != "${PYTHON_VERSION}+${BUILD_TAG}" ]; then
    echo "📥 Downloading Portable Python ${PYTHON_VERSION} (Tag: ${BUILD_TAG})..."
    rm -rf "${BIN_DIR}/python-runtime"
    curl -L "${URL}" -o "python-standalone.tar.gz"
    mkdir -p "${BIN_DIR}/python-runtime"
    tar -xzf "python-standalone.tar.gz" -C "${BIN_DIR}/python-runtime" --strip-components=1
    echo "${PYTHON_VERSION}+${BUILD_TAG}" > "${BIN_DIR}/python-runtime/BIN_VERSION"
    rm "python-standalone.tar.gz"
    echo "✅ Python downloaded and installed."
else
    echo "ℹ️ Portable Python ${PYTHON_VERSION} already exists."
fi

# 3. Export site-packages
echo "📦 Exporting site-packages from .venv..."
# Important: Ensure we use the path for 3.13
if [ ! -d ".venv/lib/python3.13/site-packages" ]; then
    echo "❌ Error: .venv/lib/python3.13/site-packages not found."
    echo "Please run 'uv sync' first."
    exit 1
fi

# Clean up old packages to avoid version mixing
rm -rf "${SITE_PACKAGES_DIR}"/*

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
