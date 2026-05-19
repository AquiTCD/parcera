#!/bin/bash
set -e

if [[ "$(uname)" != "Darwin" ]]; then
    echo "❌ This script is macOS only. Use scripts/prepare_sidecar.ps1 on Windows."
    exit 1
fi

# Configuration
# Updated to match project Python version and latest standalone build
PYTHON_VERSION="3.13.13"
BUILD_TAG="20260510"
PLATFORM="aarch64-apple-darwin"
URL="https://github.com/astral-sh/python-build-standalone/releases/download/${BUILD_TAG}/cpython-${PYTHON_VERSION}+${BUILD_TAG}-${PLATFORM}-install_only.tar.gz"

RESOURCE_DIR="ui/resources"
BIN_DIR="${RESOURCE_DIR}/bin"
SITE_PACKAGES_DIR="${RESOURCE_DIR}/site-packages"

echo "🚀 Preparing Sidecar Resources (Python ${PYTHON_VERSION})..."

# 1. Create directories
mkdir -p "${BIN_DIR}"
mkdir -p "${SITE_PACKAGES_DIR}"
mkdir -p "ui/build"

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
echo "📦 Exporting production site-packages..."

# Clean up old packages to avoid version mixing
rm -rf "${SITE_PACKAGES_DIR}"/*

# Install only production dependencies into the target directory
uv export --no-dev --format requirements-txt > build_reqs.txt
uv pip install -r build_reqs.txt --target "${SITE_PACKAGES_DIR}"
rm build_reqs.txt

# Clean up heavy/unneeded dependencies
echo "🧹 Cleaning up heavy dependencies..."
rm -rf "${SITE_PACKAGES_DIR}/torch"*
rm -rf "${SITE_PACKAGES_DIR}/torchaudio"*
rm -rf "${SITE_PACKAGES_DIR}/nvidia"*

# Optional STT packages — not bundled; downloaded on-demand via Settings
echo "🔌 Removing optional STT packages (installed on-demand via Settings)..."
rm -rf "${SITE_PACKAGES_DIR}/moonshine_voice"*
rm -rf "${SITE_PACKAGES_DIR}/ctranslate2"*
rm -rf "${SITE_PACKAGES_DIR}/av"*
rm -rf "${SITE_PACKAGES_DIR}/onnxruntime"*
rm -rf "${SITE_PACKAGES_DIR}/faster_whisper"*
rm -rf "${SITE_PACKAGES_DIR}/transformers"*

find "${SITE_PACKAGES_DIR}" -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true

# 4. Create Stub Torch to satisfy imports
echo "stub" > "${SITE_PACKAGES_DIR}/torch_stub_marker"
mkdir -p "${SITE_PACKAGES_DIR}/torch"
touch "${SITE_PACKAGES_DIR}/torch/__init__.py"
mkdir -p "${SITE_PACKAGES_DIR}/torchaudio"
touch "${SITE_PACKAGES_DIR}/torchaudio/__init__.py"

echo "✨ Sidecar preparation complete!"
echo "Sidecar ready. Run 'mise run build' to build, or use 'mise run package' which includes this step."
