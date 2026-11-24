#!/usr/bin/env bash
# Runs a command (e.g. `sls deploy`) with sharp's linux-x64 binaries installed, then restores host binaries.
# npm can only install one platform's optional deps at a time: https://github.com/npm/cli/issues/4828
set -euo pipefail

SHARP_VERSION=$(node -p "require('./package-lock.json').packages['node_modules/sharp'].version")

restore_host_sharp() {
  echo "Restoring host sharp binaries..."
  npm install --no-save --no-audit --no-fund "sharp@$SHARP_VERSION" >/dev/null
}
trap restore_host_sharp EXIT

echo "Installing linux-x64 sharp@$SHARP_VERSION binaries for Lambda..."
npm install --no-save --no-audit --no-fund --os=linux --cpu=x64 --libc=glibc "sharp@$SHARP_VERSION" >/dev/null

for pkg in sharp-linux-x64 sharp-libvips-linux-x64; do
  if [ ! -f "node_modules/@img/$pkg/package.json" ]; then
    echo "ERROR: node_modules/@img/$pkg is missing; refusing to continue." >&2
    exit 1
  fi
done

"$@"
