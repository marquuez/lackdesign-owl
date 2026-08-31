#!/bin/sh
set -e

upload="${LACKDESIGN_UPLOAD_DIR:-/data/uploads}"
mkdir -p "$upload"
chown -R node:node "$upload"

exec su-exec node "$@"
