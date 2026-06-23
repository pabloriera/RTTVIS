#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 3 ]]; then
  echo "Usage: $0 AUDIO IMAGE OUTPUT_JSONL" >&2
  exit 2
fi

if [[ -z "${GEMINI_API_KEY:-}" ]]; then
  echo "GEMINI_API_KEY must be set in the environment." >&2
  exit 2
fi

python -m app.prompt_pipeline \
  --audio "$1" \
  --image "$2" \
  --caption-window-s 30 \
  --caption-hop-s 8 \
  --image-variants 6 \
  --out "$3"
