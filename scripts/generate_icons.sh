#!/bin/bash

# Parcera Icon Generator for macOS
# Usage: ./scripts/generate_icons.sh [source_image.png]
# If no argument is provided, it defaults to 'icon.png' in the project root.

SOURCE_IMAGE=${1:-"icon.png"}
ICONSET_DIR="ui/build/icon.iconset"
OUTPUT_ICNS="ui/build/icon.icns"

if [ ! -f "$SOURCE_IMAGE" ]; then
    echo "Error: Source image '$SOURCE_IMAGE' not found."
    exit 1
fi

echo "Creating iconset from $SOURCE_IMAGE..."

# Create the iconset directory
mkdir -p "$ICONSET_DIR"

# Generate mandated sizes
# See: https://developer.apple.com/design/human-interface-guidelines/foundations/app-icons/
sips -z 16 16     -s format png "$SOURCE_IMAGE" --out "$ICONSET_DIR/icon_16x16.png"
sips -z 32 32     -s format png "$SOURCE_IMAGE" --out "$ICONSET_DIR/icon_16x16@2x.png"
sips -z 32 32     -s format png "$SOURCE_IMAGE" --out "$ICONSET_DIR/icon_32x32.png"
sips -z 64 64     -s format png "$SOURCE_IMAGE" --out "$ICONSET_DIR/icon_32x32@2x.png"
sips -z 128 128   -s format png "$SOURCE_IMAGE" --out "$ICONSET_DIR/icon_128x128.png"
sips -z 256 256   -s format png "$SOURCE_IMAGE" --out "$ICONSET_DIR/icon_128x128@2x.png"
sips -z 256 256   -s format png "$SOURCE_IMAGE" --out "$ICONSET_DIR/icon_256x256.png"
sips -z 512 512   -s format png "$SOURCE_IMAGE" --out "$ICONSET_DIR/icon_256x256@2x.png"
sips -z 512 512   -s format png "$SOURCE_IMAGE" --out "$ICONSET_DIR/icon_512x512.png"
sips -z 1024 1024 -s format png "$SOURCE_IMAGE" --out "$ICONSET_DIR/icon_512x512@2x.png"

echo "Converting iconset to $OUTPUT_ICNS..."
iconutil -c icns "$ICONSET_DIR"

# Cleanup
rm -rf "$ICONSET_DIR"

echo "Done! Icon updated at $OUTPUT_ICNS."
