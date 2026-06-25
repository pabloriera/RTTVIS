#!/usr/bin/env bash
set -euo pipefail

APP_MODULE="${APP_MODULE:-app.main:app}"
HOST="${HOST:-0.0.0.0}"
PORT="${PORT:-8070}"

MODELS_BASE_DIR="${MODELS_BASE_DIR:-/cache}"
export PYTHON_ENV_DIR="${PYTHON_ENV_DIR:-${MODELS_BASE_DIR}/python/venv}"
export VIRTUAL_ENV="${VIRTUAL_ENV:-${PYTHON_ENV_DIR}}"
export PATH="${VIRTUAL_ENV}/bin:${PATH}"

export PIP_CACHE_DIR="${PIP_CACHE_DIR:-${MODELS_BASE_DIR}/pip-cache}"
export HF_HOME="${HF_HOME:-${MODELS_BASE_DIR}/huggingface}"
export HF_HUB_CACHE="${HF_HUB_CACHE:-${HF_HOME}/hub}"
export HUGGINGFACE_HUB_CACHE="${HUGGINGFACE_HUB_CACHE:-${HF_HUB_CACHE}}"
export HF_XET_CACHE="${HF_XET_CACHE:-${HF_HOME}/xet}"
export TORCH_HOME="${TORCH_HOME:-${MODELS_BASE_DIR}/torch}"
export TORCH_INDEX_URL="${TORCH_INDEX_URL:-https://download.pytorch.org/whl/cu124}"

export IMAGE_MODEL_ID="${IMAGE_MODEL_ID:-stabilityai/sd-turbo}"
export IMAGE_MODEL_DIR="${IMAGE_MODEL_DIR:-${MODELS_BASE_DIR}/image/sd-turbo}"
export IMAGE_GENERATION_DEVICE="${IMAGE_GENERATION_DEVICE:-cuda}"
export IMAGE_GENERATION_DTYPE="${IMAGE_GENERATION_DTYPE:-float16}"
export IMAGE_WIDTH="${IMAGE_WIDTH:-512}"
export IMAGE_HEIGHT="${IMAGE_HEIGHT:-512}"
export IMAGE_NUM_INFERENCE_STEPS="${IMAGE_NUM_INFERENCE_STEPS:-1}"
export IMAGE_GUIDANCE_SCALE="${IMAGE_GUIDANCE_SCALE:-0.0}"
export IMAGE_PROMPT_CONDITIONING_MODE="${IMAGE_PROMPT_CONDITIONING_MODE:-prompt}"
export Z_IMAGE_MODEL_ID="${Z_IMAGE_MODEL_ID:-Tongyi-MAI/Z-Image-Turbo}"
export Z_IMAGE_MODEL_DIR="${Z_IMAGE_MODEL_DIR:-${MODELS_BASE_DIR}/image/z-image-turbo}"
export Z_IMAGE_WIDTH="${Z_IMAGE_WIDTH:-1024}"
export Z_IMAGE_HEIGHT="${Z_IMAGE_HEIGHT:-1024}"
export Z_IMAGE_NUM_INFERENCE_STEPS="${Z_IMAGE_NUM_INFERENCE_STEPS:-8}"
export Z_IMAGE_GUIDANCE_SCALE="${Z_IMAGE_GUIDANCE_SCALE:-0.0}"
export Z_IMAGE_GENERATION_DTYPE="${Z_IMAGE_GENERATION_DTYPE:-bfloat16}"
export LUMINA_IMAGE_MODEL_ID="${LUMINA_IMAGE_MODEL_ID:-Alpha-VLLM/Lumina-Image-2.0}"
export LUMINA_IMAGE_MODEL_DIR="${LUMINA_IMAGE_MODEL_DIR:-${MODELS_BASE_DIR}/image/lumina-image-2}"
export LUMINA_IMAGE_WIDTH="${LUMINA_IMAGE_WIDTH:-1024}"
export LUMINA_IMAGE_HEIGHT="${LUMINA_IMAGE_HEIGHT:-1024}"
export LUMINA_IMAGE_NUM_INFERENCE_STEPS="${LUMINA_IMAGE_NUM_INFERENCE_STEPS:-50}"
export LUMINA_IMAGE_GUIDANCE_SCALE="${LUMINA_IMAGE_GUIDANCE_SCALE:-4.0}"
export LUMINA_IMAGE_GENERATION_DTYPE="${LUMINA_IMAGE_GENERATION_DTYPE:-bfloat16}"

export ASR_MODEL_PATH="${ASR_MODEL_PATH:-${MODELS_BASE_DIR}/asr/vosk-model-es-0.42}"
export ASR_SAMPLE_RATE="${ASR_SAMPLE_RATE:-16000}"

export LIBRETRANSLATE_URL="${LIBRETRANSLATE_URL:-http://172.18.0.1:5070}"
export TRANSLATION_SOURCE="${TRANSLATION_SOURCE:-es}"
export TRANSLATION_TARGET="${TRANSLATION_TARGET:-en}"
export TRANSLATION_TIMEOUT_SECONDS="${TRANSLATION_TIMEOUT_SECONDS:-8}"
export TRANSLATION_STRICT="${TRANSLATION_STRICT:-false}"

mkdir -p /workspace/.run "${HF_HOME}" "${HF_HUB_CACHE}" "${HF_XET_CACHE}"

existing_pids="$(pgrep -f "uvicorn ${APP_MODULE}" || true)"
if [ -n "${existing_pids}" ]; then
  echo "Stopping existing Uvicorn process(es): ${existing_pids}"
  # shellcheck disable=SC2086
  kill ${existing_pids} 2>/dev/null || true
  sleep 2
fi

remaining_pids="$(pgrep -f "uvicorn ${APP_MODULE}" || true)"
if [ -n "${remaining_pids}" ]; then
  echo "Force stopping existing Uvicorn process(es): ${remaining_pids}"
  # shellcheck disable=SC2086
  kill -9 ${remaining_pids} 2>/dev/null || true
fi

echo "Starting ${APP_MODULE} on ${HOST}:${PORT}"
echo "Image: ${IMAGE_MODEL_ID} at ${IMAGE_MODEL_DIR} (${IMAGE_GENERATION_DEVICE}/${IMAGE_GENERATION_DTYPE})"
echo "Z-Image: ${Z_IMAGE_MODEL_ID} at ${Z_IMAGE_MODEL_DIR} (${Z_IMAGE_GENERATION_DTYPE})"
echo "Lumina: ${LUMINA_IMAGE_MODEL_ID} at ${LUMINA_IMAGE_MODEL_DIR} (${LUMINA_IMAGE_GENERATION_DTYPE})"
echo "Prompt conditioning: ${IMAGE_PROMPT_CONDITIONING_MODE}"
echo "ASR: ${ASR_MODEL_PATH}"
echo "Translation: ${LIBRETRANSLATE_URL} (${TRANSLATION_SOURCE}->${TRANSLATION_TARGET})"

exec uvicorn "${APP_MODULE}" --host "${HOST}" --port "${PORT}"
