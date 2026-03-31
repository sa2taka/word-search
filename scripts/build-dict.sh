#!/usr/bin/env bash
set -euo pipefail

OUT_DIR="${1:-dist-dict}"

echo "=== Dictionary Build Pipeline ==="
npx tsx scripts/dict/build.ts "$OUT_DIR"
