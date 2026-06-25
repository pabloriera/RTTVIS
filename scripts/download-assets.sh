#!/usr/bin/env bash
set -euo pipefail

PYTHON_BIN="${PYTHON_BIN:-python3}"
if ! command -v "${PYTHON_BIN}" >/dev/null 2>&1; then
  PYTHON_BIN=python
fi

MODELS_BASE_DIR="${MODELS_BASE_DIR:-/cache}"
PYTHON_ENV_DIR="${PYTHON_ENV_DIR:-${MODELS_BASE_DIR}/python/venv}"
PIP_CACHE_DIR="${PIP_CACHE_DIR:-${MODELS_BASE_DIR}/pip-cache}"
HF_HOME="${HF_HOME:-${MODELS_BASE_DIR}/huggingface}"
HF_HUB_CACHE="${HF_HUB_CACHE:-${HF_HOME}/hub}"
HUGGINGFACE_HUB_CACHE="${HUGGINGFACE_HUB_CACHE:-${HF_HUB_CACHE}}"
HF_XET_CACHE="${HF_XET_CACHE:-${HF_HOME}/xet}"
TORCH_INDEX_URL="${TORCH_INDEX_URL:-https://download.pytorch.org/whl/cu124}"
IMAGE_MODEL_ID="${IMAGE_MODEL_ID:-stabilityai/sd-turbo}"
IMAGE_MODEL_DIR="${IMAGE_MODEL_DIR:-${MODELS_BASE_DIR}/image/sd-turbo}"
Z_IMAGE_MODEL_ID="${Z_IMAGE_MODEL_ID:-Tongyi-MAI/Z-Image-Turbo}"
Z_IMAGE_MODEL_DIR="${Z_IMAGE_MODEL_DIR:-${MODELS_BASE_DIR}/image/z-image-turbo}"
LUMINA_IMAGE_MODEL_ID="${LUMINA_IMAGE_MODEL_ID:-Alpha-VLLM/Lumina-Image-2.0}"
LUMINA_IMAGE_MODEL_DIR="${LUMINA_IMAGE_MODEL_DIR:-${MODELS_BASE_DIR}/image/lumina-image-2}"
ASR_MODELS_DIR="${ASR_MODELS_DIR:-${MODELS_BASE_DIR}/asr}"
ASR_MODEL_NAME="${ASR_MODEL_NAME:-vosk-model-es-0.42}"
ASR_MODEL_BASE_URL="${ASR_MODEL_BASE_URL:-https://alphacephei.com/vosk/models}"
ASR_MODEL_PATH="${ASR_MODEL_PATH:-${ASR_MODELS_DIR}/${ASR_MODEL_NAME}}"
DOWNLOAD_PYTHON_DEPS="${DOWNLOAD_PYTHON_DEPS:-1}"
DOWNLOAD_IMAGE_MODEL="${DOWNLOAD_IMAGE_MODEL:-1}"
DOWNLOAD_Z_IMAGE_MODEL="${DOWNLOAD_Z_IMAGE_MODEL:-0}"
DOWNLOAD_LUMINA_IMAGE_MODEL="${DOWNLOAD_LUMINA_IMAGE_MODEL:-0}"
DOWNLOAD_ALL_IMAGE_MODELS="${DOWNLOAD_ALL_IMAGE_MODELS:-0}"
DOWNLOAD_ASR_DEPS="${DOWNLOAD_ASR_DEPS:-0}"
DOWNLOAD_ASR_MODEL="${DOWNLOAD_ASR_MODEL:-0}"

if [ "${IMAGE_MODEL_ID}" = "sd-turbo" ]; then
  IMAGE_MODEL_ID="stabilityai/sd-turbo"
fi

if [ "${IMAGE_MODEL_ID}" = "z-image-turbo" ]; then
  IMAGE_MODEL_ID="${Z_IMAGE_MODEL_ID}"
  IMAGE_MODEL_DIR="${Z_IMAGE_MODEL_DIR}"
fi

if [ "${IMAGE_MODEL_ID}" = "lumina-image-2" ]; then
  IMAGE_MODEL_ID="${LUMINA_IMAGE_MODEL_ID}"
  IMAGE_MODEL_DIR="${LUMINA_IMAGE_MODEL_DIR}"
fi

if [ "${IMAGE_MODEL_ID}" != "stabilityai/sd-turbo" ] && [ "${IMAGE_MODEL_ID}" != "${Z_IMAGE_MODEL_ID}" ] && [ "${IMAGE_MODEL_ID}" != "${LUMINA_IMAGE_MODEL_ID}" ]; then
  echo "Supported image models are stabilityai/sd-turbo, ${Z_IMAGE_MODEL_ID}, and ${LUMINA_IMAGE_MODEL_ID}." >&2
  exit 1
fi

export PIP_CACHE_DIR HF_HOME HF_HUB_CACHE HUGGINGFACE_HUB_CACHE HF_XET_CACHE

mkdir -p "${PYTHON_ENV_DIR%/*}" "${PIP_CACHE_DIR}" "${HF_HOME}" "${HF_HUB_CACHE}" "${HF_XET_CACHE}" "${IMAGE_MODEL_DIR}" "${Z_IMAGE_MODEL_DIR}" "${LUMINA_IMAGE_MODEL_DIR}" "${ASR_MODELS_DIR}"

install_python_deps() {
  if [ ! -x "${PYTHON_ENV_DIR}/bin/python" ]; then
    echo "Creating Python environment at ${PYTHON_ENV_DIR}"
    "${PYTHON_BIN}" -m venv "${PYTHON_ENV_DIR}"
  fi

  if "${PYTHON_ENV_DIR}/bin/python" - <<'PY' >/dev/null 2>&1
import diffusers
import fastapi
import torch
import uvicorn
from PIL import Image
from diffusers import DiffusionPipeline
PY
  then
    echo "Image Python runtime already present at ${PYTHON_ENV_DIR}"
    return
  fi

  echo "Installing image Python runtime into ${PYTHON_ENV_DIR}"
  "${PYTHON_ENV_DIR}/bin/python" -m pip install --upgrade pip setuptools wheel
  "${PYTHON_ENV_DIR}/bin/python" -m pip install --index-url "${TORCH_INDEX_URL}" \
    torch \
    torchvision \
    torchaudio
  "${PYTHON_ENV_DIR}/bin/python" -m pip install \
    "diffusers[torch]" \
    accelerate \
    "fastapi[standard]" \
    huggingface_hub \
    pillow \
    safetensors \
    transformers \
    "uvicorn[standard]"
}

install_asr_deps() {
  if "${PYTHON_ENV_DIR}/bin/python" - <<'PY' >/dev/null 2>&1
import vosk
PY
  then
    echo "ASR Python runtime already present at ${PYTHON_ENV_DIR}"
    return
  fi

  echo "Installing ASR Python runtime into ${PYTHON_ENV_DIR}"
  "${PYTHON_ENV_DIR}/bin/python" -m pip install vosk
}

download_hf_model() {
  local repo_id="$1"
  local model_dir="$2"
  local label="$3"

  if [ -f "${model_dir}/model_index.json" ]; then
    echo "${label} already present at ${model_dir}"
    return
  fi

  echo "Downloading ${repo_id} into ${model_dir}"
  REPO_ID="${repo_id}" MODEL_DIR="${model_dir}" "${PYTHON_ENV_DIR}/bin/python" - <<'PY'
import os
from huggingface_hub import snapshot_download

snapshot_download(
    repo_id=os.environ["REPO_ID"],
    local_dir=os.environ["MODEL_DIR"],
    token=os.environ.get("HF_TOKEN") or None,
)

print(f"Image model ready at {os.environ['MODEL_DIR']}")
PY
}

download_asr_model() {
  if [ -f "${ASR_MODEL_PATH}/conf/model.conf" ]; then
    echo "ASR model already present at ${ASR_MODEL_PATH}"
    return
  fi

  local model_dir="${ASR_MODELS_DIR}/${ASR_MODEL_NAME}"
  local zip_path="/tmp/${ASR_MODEL_NAME}.zip"
  local model_url="${ASR_MODEL_BASE_URL}/${ASR_MODEL_NAME}.zip"

  if [ ! -d "${model_dir}" ]; then
    echo "Downloading ${model_url} into ${ASR_MODELS_DIR}"
    curl -L "${model_url}" -o "${zip_path}"
    unzip -q "${zip_path}" -d "${ASR_MODELS_DIR}"
    rm -f "${zip_path}"
  fi

  if [ "${ASR_MODEL_PATH}" != "${model_dir}" ]; then
    rm -rf "${ASR_MODEL_PATH}"
    ln -s "${model_dir}" "${ASR_MODEL_PATH}"
  fi

  echo "ASR model ready at ${ASR_MODEL_PATH}"
}

if [ "${DOWNLOAD_PYTHON_DEPS}" = "1" ]; then
  install_python_deps
else
  echo "Skipping Python dependency download because DOWNLOAD_PYTHON_DEPS=${DOWNLOAD_PYTHON_DEPS}"
fi

if [ "${DOWNLOAD_ASR_DEPS}" = "1" ]; then
  install_asr_deps
else
  echo "Skipping ASR Python dependency download because DOWNLOAD_ASR_DEPS=${DOWNLOAD_ASR_DEPS}"
fi

if [ "${DOWNLOAD_IMAGE_MODEL}" = "1" ]; then
  download_hf_model "${IMAGE_MODEL_ID}" "${IMAGE_MODEL_DIR}" "${IMAGE_MODEL_ID}"
else
  echo "Skipping image model download because DOWNLOAD_IMAGE_MODEL=${DOWNLOAD_IMAGE_MODEL}"
fi

if [ "${DOWNLOAD_Z_IMAGE_MODEL}" = "1" ] || [ "${DOWNLOAD_ALL_IMAGE_MODELS}" = "1" ]; then
  download_hf_model "${Z_IMAGE_MODEL_ID}" "${Z_IMAGE_MODEL_DIR}" "${Z_IMAGE_MODEL_ID}"
fi

if [ "${DOWNLOAD_LUMINA_IMAGE_MODEL}" = "1" ] || [ "${DOWNLOAD_ALL_IMAGE_MODELS}" = "1" ]; then
  download_hf_model "${LUMINA_IMAGE_MODEL_ID}" "${LUMINA_IMAGE_MODEL_DIR}" "${LUMINA_IMAGE_MODEL_ID}"
fi

if [ "${DOWNLOAD_ALL_IMAGE_MODELS}" = "1" ] && [ "${IMAGE_MODEL_ID}" != "stabilityai/sd-turbo" ]; then
  download_hf_model "stabilityai/sd-turbo" "/models/image/sd-turbo" "stabilityai/sd-turbo"
fi

if [ "${DOWNLOAD_ASR_MODEL}" = "1" ]; then
  download_asr_model
else
  echo "Skipping ASR model download because DOWNLOAD_ASR_MODEL=${DOWNLOAD_ASR_MODEL}"
fi

echo "Asset download step complete."
