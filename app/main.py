from __future__ import annotations

import json
import logging
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
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


class GenerateResponse(BaseModel):
    job_id: int
    stale: bool
    image_png_base64: str | None
    images_png_base64: list[str] | None = None
    elapsed_ms: int
    prompt: str
    translated_prompt: str | None = None
    translated_additional_prompt: str | None = None
    translation_applied: bool = False
    translation_error: str | None = None


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

    return GenerateResponse(
        job_id=result.job_id,
        stale=result.stale,
        image_png_base64=result.image_png_base64,
        images_png_base64=result.images_png_base64,
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
