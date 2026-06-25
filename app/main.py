from __future__ import annotations

import asyncio
import base64
import colorsys
import io
import json
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
import httpx
import numpy as np
from PIL import Image
from pydantic import BaseModel, Field

from .image_worker import (
    BATCH_PERTURBATION_SCALE,
    GenerationSettings,
    ImageGenerationWorker,
    PromptBlendSettings,
    PromptWalkSettings,
    get_image_config,
)
from .transcription import TranscriptionManager, get_transcription_config
from .translation import TranslationManager, get_translation_config


STATIC_DIR = Path(__file__).parent / "static"
logger = logging.getLogger(__name__)
SAM_SEGMENT_URL = os.environ.get("SAM_SEGMENT_URL", "http://172.17.0.2:8060/v1/segment")
SAM_SEGMENT_TIMEOUT_SECONDS = float(os.environ.get("SAM_SEGMENT_TIMEOUT_SECONDS", "15"))
SAM_SEGMENT_PROMPT = "stuff"


def sam_mask_to_rgba(mask_img: Image.Image, prompt: str) -> str | None:
    mask_array = np.array(mask_img)
    if mask_array.ndim == 3:
        if mask_array.shape[2] >= 4 and mask_array[:, :, 3].max() > 0:
            instance_array = mask_array[:, :, 3]
        else:
            instance_array = np.max(mask_array[:, :, :3], axis=2)
    else:
        instance_array = mask_array

    if np.issubdtype(instance_array.dtype, np.floating):
        finite_values = instance_array[np.isfinite(instance_array)]
        if finite_values.size == 0:
            return None
        threshold = 0.5 if float(finite_values.max()) <= 1.0 else 0.0
        foreground = np.isfinite(instance_array) & (instance_array > threshold)
    else:
        foreground = instance_array > 0

    if not np.any(foreground):
        logger.warning(f"SAM 3 returned an empty mask for prompt: '{prompt}'")
        return None

    h, w = instance_array.shape
    color_mask = np.zeros((h, w, 4), dtype=np.uint8)
    unique_ids = np.unique(instance_array[foreground])
    logger.info(f"SAM 3 segmented {len(unique_ids)} mask value(s) for prompt: '{prompt}'")

    if unique_ids.size > 256:
        color_mask[foreground] = [0, 180, 255, 255]
    else:
        for obj_id in unique_ids:
            hue = (int(obj_id) * 137.508) % 360 / 360.0
            r, g, b = colorsys.hsv_to_rgb(hue, 0.8, 1.0)
            color_mask[instance_array == obj_id] = [int(r * 255), int(g * 255), int(b * 255), 255]

    out_img = Image.fromarray(color_mask, mode="RGBA")
    out_io = io.BytesIO()
    out_img.save(out_io, format="PNG")
    return base64.b64encode(out_io.getvalue()).decode("utf-8")


async def get_sam_mask_async(image_base64: str, prompt: str) -> str | None:
    if not image_base64:
        return None
    if image_base64.startswith("data:image/") and "," in image_base64:
        image_base64 = image_base64.split(",", 1)[1]
    try:
        image_bytes = base64.b64decode(image_base64)
    except Exception as e:
        logger.error(f"Failed to decode image_base64: {e}")
        return None

    files = {"image": ("image.png", image_bytes, "image/png")}
    data = {"request": json.dumps({"prompt": {"type": "text", "text": prompt}})}

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                SAM_SEGMENT_URL,
                files=files,
                data=data,
                timeout=SAM_SEGMENT_TIMEOUT_SECONDS,
            )
            if response.status_code == 200:
                mask_img = Image.open(io.BytesIO(response.content))
                return sam_mask_to_rgba(mask_img, prompt)
            else:
                logger.error(f"SAM 3 service error: status code {response.status_code}, response: {response.text}")
    except Exception as e:
        logger.error(f"Failed to connect to SAM 3 service: {e}")
    return None


@asynccontextmanager
async def lifespan(app: FastAPI):
    worker = ImageGenerationWorker(get_image_config())
    transcription_manager = TranscriptionManager(get_transcription_config())
    translation_manager = TranslationManager(get_translation_config())
    try:
        app.state.image_worker = worker
        app.state.transcription_manager = transcription_manager
        app.state.translation_manager = translation_manager
        await worker.warmup()
        yield
    finally:
        worker.close()


app = FastAPI(title="RTIAVIS Image Prompt", lifespan=lifespan)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


class GenerateRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=4000)
    model_id: str | None = None
    translate: bool | None = None
    width: int | None = Field(default=None, ge=64, le=2048)
    height: int | None = Field(default=None, ge=64, le=2048)
    num_inference_steps: int | None = Field(default=None, ge=1, le=50)
    guidance_scale: float | None = Field(default=None, ge=0.0, le=10.0)
    seed: int | None = Field(default=None, ge=0, le=2**32 - 1)
    batch_size: int | None = Field(default=None, ge=1, le=8)
    batch_walk: bool | None = Field(default=None)
    additional_prompt: str | None = Field(default=None, max_length=4000)
    additional_prompt_weight: float | None = Field(default=None, ge=0.0, le=1.0)
    prompt_walk_step: int | None = Field(default=None, ge=0, le=10000)
    prompt_walk_seed: int | None = Field(default=None, ge=0, le=2**32 - 1)
    prompt_walk_scale: float | None = Field(default=None, ge=0.0)
    prompt_walk_momentum: float | None = Field(default=None, ge=0.0, le=0.999)
    prompt_walk_turn_scale: float | None = Field(default=None, ge=0.0, le=2.0)
    sam: bool | None = Field(default=None)
    sam_prompt: str | None = Field(default=None, max_length=1000)


class GenerateResponse(BaseModel):
    job_id: int
    stale: bool
    image_png_base64: str | None
    images_png_base64: list[str] | None = None
    masks_png_base64: list[str] | None = None
    elapsed_ms: int
    prompt: str
    translated_prompt: str | None = None
    translated_additional_prompt: str | None = None
    translation_applied: bool = False
    translation_error: str | None = None


class SegmentRequest(BaseModel):
    images_png_base64: list[str]
    prompt: str
    translate: bool | None = None


def get_worker(request: Request) -> ImageGenerationWorker:
    return request.app.state.image_worker


def get_transcription_manager(request: Request | WebSocket) -> TranscriptionManager:
    return request.app.state.transcription_manager


def get_translation_manager(request: Request) -> TranslationManager:
    return request.app.state.translation_manager


@app.get("/")
async def index() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/projector")
async def projector() -> FileResponse:
    return FileResponse(STATIC_DIR / "projector.html")


@app.api_route("/favicon.ico", methods=["GET", "HEAD"], include_in_schema=False)
async def favicon() -> FileResponse:
    return FileResponse(STATIC_DIR / "favicon.svg", media_type="image/svg+xml")


@app.get("/api/health")
async def health(request: Request) -> dict[str, Any]:
    worker = get_worker(request)
    transcription_manager = get_transcription_manager(request)
    translation_manager = get_translation_manager(request)
    return {
        "ok": True,
        "image_worker": worker.snapshot(),
        "transcription": transcription_manager.snapshot(),
        "translation": translation_manager.snapshot(),
    }


@app.get("/api/config")
async def config(request: Request) -> dict[str, Any]:
    worker = get_worker(request)
    transcription_manager = get_transcription_manager(request)
    translation_manager = get_translation_manager(request)
    return {
        "image": worker.config.public_dict(),
        "transcription": transcription_manager.snapshot(),
        "translation": translation_manager.snapshot(),
        "features": {
            "dictation": True,
            "translation": True,
            "model_picker": True,
        },
    }


@app.post("/api/generate", response_model=GenerateResponse)
async def generate(payload: GenerateRequest, request: Request) -> GenerateResponse:
    prompt = payload.prompt.strip()
    if not prompt:
        raise HTTPException(status_code=422, detail="Prompt cannot be empty.")
    for dimension_name, dimension_value in (("width", payload.width), ("height", payload.height)):
        if dimension_value is not None and dimension_value % 8 != 0:
            raise HTTPException(status_code=422, detail=f"{dimension_name} must be divisible by 8.")

    worker = get_worker(request)
    translation_manager = get_translation_manager(request)
    model_key = worker.resolve_model_key(payload.model_id)
    model_spec = worker.get_model_spec(model_key)
    additional_prompt = (payload.additional_prompt or "").strip()
    prompt_walk = None
    if payload.prompt_walk_step is not None:
        prompt_walk = PromptWalkSettings(
            step=payload.prompt_walk_step,
            seed=payload.prompt_walk_seed or 0,
            scale=payload.prompt_walk_scale if payload.prompt_walk_scale is not None else 0.01,
            momentum=(
                payload.prompt_walk_momentum
                if payload.prompt_walk_momentum is not None
                else 0.92
            ),
            turn_scale=(
                payload.prompt_walk_turn_scale
                if payload.prompt_walk_turn_scale is not None
                else 0.35
            ),
        )
    prompt_blend = None
    additional_prompt_weight = (
        payload.additional_prompt_weight
        if payload.additional_prompt_weight is not None
        else 0.25
    )
    if additional_prompt and additional_prompt_weight > 0:
        prompt_blend = PromptBlendSettings(
            prompt=additional_prompt,
            weight=1 - additional_prompt_weight,
        )
    settings = GenerationSettings(
        model_key=model_key,
        width=payload.width or model_spec.width,
        height=payload.height or model_spec.height,
        num_inference_steps=payload.num_inference_steps or model_spec.num_inference_steps,
        guidance_scale=(
            model_spec.guidance_scale
            if payload.guidance_scale is None
            else payload.guidance_scale
        ),
        seed=payload.seed,
        prompt_walk=prompt_walk,
        prompt_blend=prompt_blend,
        batch_size=payload.batch_size or 1,
        batch_walk=payload.batch_walk or False,
        batch_walk_scale=(
            payload.prompt_walk_scale
            if payload.prompt_walk_scale is not None
            else BATCH_PERTURBATION_SCALE
        ),
    )
    try:
        translation = await translation_manager.translate(prompt, enabled=payload.translate)
        additional_translation = None
        if prompt_blend is not None:
            additional_translation = await translation_manager.translate(
                prompt_blend.prompt,
                enabled=payload.translate,
            )
            prompt_blend = PromptBlendSettings(
                prompt=additional_translation.text,
                weight=prompt_blend.weight,
            )
            settings = GenerationSettings(
                model_key=settings.model_key,
                width=settings.width,
                height=settings.height,
                num_inference_steps=settings.num_inference_steps,
                guidance_scale=settings.guidance_scale,
                seed=settings.seed,
                prompt_walk=settings.prompt_walk,
                prompt_blend=prompt_blend,
                batch_size=settings.batch_size,
                batch_walk=settings.batch_walk,
                batch_walk_scale=settings.batch_walk_scale,
            )
        result = await worker.submit(translation.text, settings=settings)
    except Exception as exc:
        logger.exception("Image generation failed.")
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    masks_png_base64 = None
    if payload.sam:
        s_prompt = payload.sam_prompt if payload.sam_prompt is not None else SAM_SEGMENT_PROMPT
        if result.images_png_base64:
            tasks = [get_sam_mask_async(img_b64, s_prompt) for img_b64 in result.images_png_base64]
            masks_res = await asyncio.gather(*tasks)
            masks_png_base64 = [m if m is not None else "" for m in masks_res]
        elif result.image_png_base64:
            mask = await get_sam_mask_async(result.image_png_base64, s_prompt)
            masks_png_base64 = [mask if mask is not None else ""]

    return GenerateResponse(
        job_id=result.job_id,
        stale=result.stale,
        image_png_base64=result.image_png_base64,
        images_png_base64=result.images_png_base64,
        masks_png_base64=masks_png_base64,
        elapsed_ms=result.elapsed_ms,
        prompt=prompt,
        translated_prompt=translation.text if translation.applied else None,
        translated_additional_prompt=(
            additional_translation.text
            if additional_translation is not None and additional_translation.applied
            else None
        ),
        translation_applied=(
            translation.applied
            or (additional_translation.applied if additional_translation is not None else False)
        ),
        translation_error=translation.error
        or (additional_translation.error if additional_translation is not None else None),
    )


@app.post("/api/segment")
async def segment(payload: SegmentRequest, request: Request) -> dict[str, Any]:
    translation_manager = request.app.state.translation_manager
    prompt = payload.prompt
    if payload.translate:
        try:
            translation = await translation_manager.translate(prompt, enabled=True)
            prompt = translation.text
        except Exception as e:
            logger.error(f"Failed to translate segment prompt: {e}")
    tasks = [get_sam_mask_async(img_b64, prompt) for img_b64 in payload.images_png_base64]
    masks_res = await asyncio.gather(*tasks)
    masks_png_base64 = [m if m is not None else "" for m in masks_res]
    return {"masks_png_base64": masks_png_base64}


@app.websocket("/ws/transcribe")
async def transcribe(websocket: WebSocket) -> None:
    await websocket.accept()
    manager = get_transcription_manager(websocket)
    session = None

    try:
        while True:
            message = await websocket.receive()
            if message.get("type") == "websocket.disconnect":
                break

            if message.get("text") is not None:
                payload = message["text"]
                try:
                    data = json.loads(payload)
                except ValueError:
                    continue

                if data.get("type") == "start":
                    session = manager.create_session(sample_rate=int(data.get("sample_rate") or 16000))
                    await websocket.send_json({"type": "ready"})
                elif data.get("type") == "reset":
                    session = manager.create_session(sample_rate=int(data.get("sample_rate") or 16000))
                    await websocket.send_json({"type": "reset"})
                elif data.get("type") == "stop" and session is not None:
                    await websocket.send_json(session.final_result())
                    break
                continue

            pcm_bytes = message.get("bytes")
            if pcm_bytes is None:
                continue
            if session is None:
                session = manager.create_session()

            result = session.accept_audio(pcm_bytes)
            if result["text"]:
                await websocket.send_json(result)
    except WebSocketDisconnect:
        return
    except Exception as exc:
        await websocket.send_json({"type": "error", "message": str(exc)})
