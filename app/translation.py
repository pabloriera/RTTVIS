from __future__ import annotations

import asyncio
import json
import os
from dataclasses import dataclass
from typing import Any
from urllib import request
from urllib.error import URLError


DEFAULT_TRANSLATION_SOURCE = "es"
DEFAULT_TRANSLATION_TARGET = "en"
DEFAULT_TRANSLATION_TIMEOUT_SECONDS = 8.0


@dataclass(frozen=True)
class TranslationConfig:
    base_url: str | None
    enabled: bool
    source: str
    target: str
    api_key: str | None
    timeout_seconds: float
    strict: bool

    def public_dict(self) -> dict[str, Any]:
        return {
            "configured": self.base_url is not None,
            "enabled": self.enabled,
            "source": self.source,
            "target": self.target,
            "strict": self.strict,
        }


@dataclass(frozen=True)
class TranslationResult:
    original_text: str
    text: str
    applied: bool
    error: str | None = None


def _env_bool(name: str, default: bool) -> bool:
    raw_value = os.environ.get(name)
    if raw_value is None or raw_value == "":
        return default
    return raw_value.strip().lower() in {"1", "true", "yes", "on"}


def get_translation_config() -> TranslationConfig:
    raw_url = os.environ.get("LIBRETRANSLATE_URL", "").strip().rstrip("/")
    base_url = raw_url or None
    return TranslationConfig(
        base_url=base_url,
        enabled=_env_bool("TRANSLATION_ENABLED", base_url is not None),
        source=os.environ.get("TRANSLATION_SOURCE", DEFAULT_TRANSLATION_SOURCE).strip()
        or DEFAULT_TRANSLATION_SOURCE,
        target=os.environ.get("TRANSLATION_TARGET", DEFAULT_TRANSLATION_TARGET).strip()
        or DEFAULT_TRANSLATION_TARGET,
        api_key=os.environ.get("LIBRETRANSLATE_API_KEY") or None,
        timeout_seconds=float(
            os.environ.get("TRANSLATION_TIMEOUT_SECONDS", DEFAULT_TRANSLATION_TIMEOUT_SECONDS)
        ),
        strict=_env_bool("TRANSLATION_STRICT", False),
    )


class TranslationManager:
    def __init__(self, config: TranslationConfig) -> None:
        self.config = config

    def snapshot(self) -> dict[str, Any]:
        return self.config.public_dict()

    async def translate(self, text: str, *, enabled: bool | None = None) -> TranslationResult:
        should_translate = self.config.enabled if enabled is None else enabled
        if not should_translate or self.config.base_url is None:
            return TranslationResult(original_text=text, text=text, applied=False)

        try:
            translated_text = await asyncio.to_thread(self._translate_sync, text)
        except Exception as exc:
            if self.config.strict:
                raise RuntimeError(f"Translation failed: {exc}") from exc
            return TranslationResult(
                original_text=text,
                text=text,
                applied=False,
                error=str(exc),
            )

        normalized_text = translated_text.strip()
        if not normalized_text:
            return TranslationResult(original_text=text, text=text, applied=False)

        return TranslationResult(
            original_text=text,
            text=normalized_text,
            applied=normalized_text != text,
        )

    def _translate_sync(self, text: str) -> str:
        if self.config.base_url is None:
            return text

        payload: dict[str, Any] = {
            "q": text,
            "source": self.config.source,
            "target": self.config.target,
            "format": "text",
        }
        if self.config.api_key:
            payload["api_key"] = self.config.api_key

        encoded_payload = json.dumps(payload).encode("utf-8")
        http_request = request.Request(
            f"{self.config.base_url}/translate",
            data=encoded_payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        try:
            with request.urlopen(http_request, timeout=self.config.timeout_seconds) as response:
                response_payload = json.loads(response.read().decode("utf-8"))
        except URLError as exc:
            raise RuntimeError(exc.reason) from exc

        translated_text = response_payload.get("translatedText")
        if not isinstance(translated_text, str):
            raise RuntimeError("LibreTranslate response did not include translatedText.")

        return translated_text
