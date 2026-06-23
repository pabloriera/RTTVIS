#!/usr/bin/env bash
set -euo pipefail

APP_PYTHON="${PYTHON_ENV_DIR:-/models/python/venv}/bin/python"

if [[ -x "$APP_PYTHON" ]]; then
  "$APP_PYTHON" -c 'import torch, diffusers; from PIL import Image; print("app cuda_available=", torch.cuda.is_available())'
else
  echo "App Python is not installed. Run: bash scripts/download-assets.sh"
fi
