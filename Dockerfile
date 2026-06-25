# syntax=docker/dockerfile:1.7
FROM nvidia/cuda:12.4.1-cudnn-runtime-ubuntu22.04

ARG DEBIAN_FRONTEND=noninteractive
ARG USERNAME=vscode
ARG USER_UID=1000
ARG USER_GID=1000

ENV PYTHONUNBUFFERED=1 \
    PYTHON_ENV_DIR=/models/python/venv \
    VIRTUAL_ENV=/models/python/venv \
    ACE_PYTHON=/models/ace/venv/bin/python \
    UV_PYTHON_INSTALL_DIR=/models/ace/uv-python \
    UV_CACHE_DIR=/models/ace/uv-cache \
    PATH=/models/python/venv/bin:$PATH \
    PIP_CACHE_DIR=/models/pip-cache \
    HF_HOME=/models/huggingface \
    HF_HUB_CACHE=/models/huggingface/hub \
    HUGGINGFACE_HUB_CACHE=/models/huggingface/hub \
    HF_XET_CACHE=/models/huggingface/xet \
    IMAGE_MODEL_DIR=/models/image/sd-turbo \
    ASR_MODEL_PATH=/models/asr/vosk-model-es-0.42 \
    ASR_SAMPLE_RATE=16000 \
    TRANSLATION_SOURCE=es \
    TRANSLATION_TARGET=en \
    TRANSLATION_TIMEOUT_SECONDS=8 \
    TRANSLATION_STRICT=false \
    TORCH_HOME=/models/torch \
    TORCH_INDEX_URL=https://download.pytorch.org/whl/cu124 \
    IMAGE_MODEL_ID=stabilityai/sd-turbo \
    IMAGE_GENERATION_DEVICE=cuda \
    IMAGE_GENERATION_DTYPE=float16 \
    IMAGE_WIDTH=512 \
    IMAGE_HEIGHT=512 \
    IMAGE_NUM_INFERENCE_STEPS=1 \
    IMAGE_GUIDANCE_SCALE=0.0

RUN apt-get update && apt-get install -y --no-install-recommends \
    bash \
    build-essential \
    ca-certificates \
    curl \
    ffmpeg \
    git \
    git-lfs \
    libasound2 \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    libsndfile1 \
    pkg-config \
    portaudio19-dev \
    python3 \
    python3-dev \
    python3-pip \
    python3-venv \
    tini \
    unzip \
    wget \
    && rm -rf /var/lib/apt/lists/*

RUN git lfs install --system \
    && groupadd --gid "${USER_GID}" "${USERNAME}" \
    && useradd --uid "${USER_UID}" --gid "${USER_GID}" -m -s /bin/bash "${USERNAME}" \
    && mkdir -p /workspace /models/python /models/ace /models/pip-cache /models/huggingface /models/image /models/asr /models/torch \
    && chown -R "${USERNAME}:${USERNAME}" /workspace /models

WORKDIR /workspace
USER ${USERNAME}

EXPOSE 8070
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["bash"]
