#!/usr/bin/env bash
set -euo pipefail

DICT_DIR="${1:-dist-dict}"
BUCKET="${R2_BUCKET_NAME:?R2_BUCKET_NAME is required}"

if [ ! -f "$DICT_DIR/meta.json" ]; then
  echo "Error: meta.json not found in $DICT_DIR" >&2
  exit 1
fi

echo "=== Uploading dictionary to R2 bucket: $BUCKET ==="

# Upload dictionary DB
npx wrangler r2 object put "$BUCKET/dict.db" \
  --file "$DICT_DIR/dict.db" \
  --content-type application/x-sqlite3 \
  --remote

# Upload metadata
npx wrangler r2 object put "$BUCKET/meta.json" \
  --file "$DICT_DIR/meta.json" \
  --content-type application/json \
  --remote

# Upload license files
for license_file in "$DICT_DIR"/*LICENSE*; do
  [ -f "$license_file" ] || continue
  filename="$(basename "$license_file")"
  npx wrangler r2 object put "$BUCKET/licenses/$filename" \
    --file "$license_file" \
    --content-type text/plain \
    --remote
done

echo "=== Upload complete ==="
