#!/bin/bash
# LetXipu V11 startup script.
# spaCy is installed at image-build time; the cache is optional for local overrides.

set -e

CACHE_ROOT="/app/spacy-cache"

# Ensure cache dir exists and is writable
mkdir -p "$CACHE_ROOT"
chmod -R 777 "$CACHE_ROOT"

# Verify expected model layout (flat: config.cfg + meta.json at root)
echo "[start.sh] Checking spaCy cache at $CACHE_ROOT"
for m in es_core_news_md es_core_news_sm en_core_web_sm pt_core_news_sm; do
    if [ -f "$CACHE_ROOT/$m/config.cfg" ] && [ -f "$CACHE_ROOT/$m/meta.json" ]; then
        echo "[start.sh] OK: $m"
    else
        echo "[start.sh] MISSING: $m"
    fi
done

exec node dist/server.js
