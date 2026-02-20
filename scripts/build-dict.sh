#!/usr/bin/env bash
set -euo pipefail

WORK_DIR="$(mktemp -d)"
OUT_DIR="${1:-dist-dict}"
trap 'rm -rf "$WORK_DIR"' EXIT

mkdir -p "$OUT_DIR"

echo "=== Dictionary Build Pipeline ==="

# TODO: Download SudachiDict
# curl -L -o "$WORK_DIR/sudachi.zip" "https://..."
# unzip "$WORK_DIR/sudachi.zip" -d "$WORK_DIR/sudachi"

# TODO: Download NEologd
# git clone --depth 1 https://github.com/neologd/mecab-ipadic-neologd "$WORK_DIR/neologd"

# TODO: Download SCOWL (English)
# curl -L -o "$WORK_DIR/scowl.zip" "https://..."

# TODO: Parse dictionaries and generate SQLite DB
# - Create tables: words_ja (surface, reading, pos), words_en (word, pos)
# - Insert parsed entries
# - Create indexes for fast search
# sqlite3 "$OUT_DIR/dict.db" < schema.sql
# python3 scripts/parse_sudachi.py ... | sqlite3 "$OUT_DIR/dict.db"
# python3 scripts/parse_scowl.py ... | sqlite3 "$OUT_DIR/dict.db"

# TODO: Generate hash for integrity verification
# sha256sum "$OUT_DIR/dict.db" | awk '{print $1}' > "$OUT_DIR/dict.db.sha256"

# TODO: Generate meta.json
# cat > "$OUT_DIR/meta.json" <<METAEOF
# {
#   "version": "$(date +%Y%m%d)",
#   "files": {
#     "dict.db": {
#       "size": $(stat -f%z "$OUT_DIR/dict.db" 2>/dev/null || stat -c%s "$OUT_DIR/dict.db"),
#       "sha256": "$(cat "$OUT_DIR/dict.db.sha256")"
#     }
#   }
# }
# METAEOF

# TODO: Copy license files into output
# cp licenses/SUDACHI_LICENSE "$OUT_DIR/"
# cp licenses/NEOLOGD_LICENSE "$OUT_DIR/"
# cp licenses/SCOWL_LICENSE "$OUT_DIR/"

echo "=== Build complete: $OUT_DIR ==="
