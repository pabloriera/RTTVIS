from __future__ import annotations

import json
import os
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Any


DEFAULT_ASR_MODEL_PATH = "/models/asr/vosk-model-es-0.42"
DEFAULT_ASR_SAMPLE_RATE = 16000


@dataclass(frozen=True)
class TranscriptionConfig:
    model_path: str
    sample_rate: int

    def public_dict(self) -> dict[str, Any]:
        path = Path(self.model_path)
        return {
            "model_path": self.model_path,
            "sample_rate": self.sample_rate,
            "model_ready": (path / "conf" / "model.conf").is_file(),
        }


def get_transcription_config() -> TranscriptionConfig:
    return TranscriptionConfig(
        model_path=os.environ.get("ASR_MODEL_PATH", DEFAULT_ASR_MODEL_PATH).strip()
        or DEFAULT_ASR_MODEL_PATH,
        sample_rate=int(os.environ.get("ASR_SAMPLE_RATE", DEFAULT_ASR_SAMPLE_RATE)),
    )


class TranscriptionManager:
    def __init__(self, config: TranscriptionConfig) -> None:
        self.config = config
        self._model: Any | None = None
        self._lock = threading.Lock()

    def snapshot(self) -> dict[str, Any]:
        return {
            **self.config.public_dict(),
            "loaded": self._model is not None,
        }

    def create_session(self, sample_rate: int | None = None) -> TranscriptionSession:
        model = self._load_model()
        return TranscriptionSession(
            model=model,
            sample_rate=sample_rate or self.config.sample_rate,
        )

    def _load_model(self) -> Any:
        if self._model is not None:
            return self._model

        model_path = Path(self.config.model_path)
        if not (model_path / "conf" / "model.conf").is_file():
            raise RuntimeError(
                f"ASR model is not installed at {model_path}. "
                "Run: DOWNLOAD_PYTHON_DEPS=0 DOWNLOAD_IMAGE_MODEL=0 "
                "DOWNLOAD_ASR_DEPS=1 DOWNLOAD_ASR_MODEL=1 bash scripts/download-assets.sh"
            )

        try:
            from vosk import Model
        except ImportError as exc:
            raise RuntimeError(
                "ASR runtime is not installed. Run: DOWNLOAD_PYTHON_DEPS=0 "
                "DOWNLOAD_IMAGE_MODEL=0 DOWNLOAD_ASR_DEPS=1 bash scripts/download-assets.sh"
            ) from exc

        with self._lock:
            if self._model is None:
                self._model = Model(str(model_path))
        return self._model


class TranscriptionSession:
    def __init__(self, *, model: Any, sample_rate: int) -> None:
        from vosk import KaldiRecognizer

        self._recognizer = KaldiRecognizer(model, sample_rate)
        self._recognizer.SetWords(True)

    def accept_audio(self, pcm_bytes: bytes) -> dict[str, str]:
        if self._recognizer.AcceptWaveform(pcm_bytes):
            payload = json.loads(self._recognizer.Result())
            return {"type": "final", "text": payload.get("text", "")}

        payload = json.loads(self._recognizer.PartialResult())
        return {"type": "partial", "text": payload.get("partial", "")}

    def final_result(self) -> dict[str, str]:
        payload = json.loads(self._recognizer.FinalResult())
        return {"type": "final", "text": payload.get("text", "")}
