#!/usr/bin/env python3
"""Build a timed sequence of image prompts from audio captions and a style image.

The audio-caption stage reuses the proven ``ace/ace_caption_chunks.py`` workflow;
its JSONL can either be generated from ``--audio`` or passed directly with
``--audio-captions``. Gemini first turns the reference image into narrative visual
variants, then merges the aligned caption/variant pairs into image-generation prompts.
"""

from __future__ import annotations

import argparse
import base64
import json
import mimetypes
import os
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Iterable, Sequence


DEFAULT_GEMINI_MODEL = "gemini-2.5-flash"
DEFAULT_GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta"
PROJECT_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_ACE_SCRIPT = PROJECT_ROOT / "ace" / "ace_caption_chunks.py"
DEFAULT_ACE_PYTHON = Path(
    os.environ.get("ACE_PYTHON", PROJECT_ROOT / "ace" / ".venv" / "bin" / "python")
)


@dataclass(frozen=True)
class AudioCaption:
    text: str
    start_s: float | None = None
    end_s: float | None = None


@dataclass(frozen=True)
class PromptPair:
    output_index: int
    audio_index: int
    image_index: int
    audio_caption: AudioCaption
    image_description: str


@dataclass(frozen=True)
class GeneratedPrompt:
    output_index: int
    audio_index: int
    image_index: int
    start_s: float | None
    end_s: float | None
    audio_caption: str
    image_description: str
    prompt: str


IMAGE_VARIANTS_SCHEMA: dict[str, Any] = {
    "type": "OBJECT",
    "properties": {
        "descriptions": {
            "type": "ARRAY",
            "items": {"type": "STRING"},
        }
    },
    "required": ["descriptions"],
}


MERGED_PROMPTS_SCHEMA: dict[str, Any] = {
    "type": "OBJECT",
    "properties": {
        "prompts": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "output_index": {"type": "INTEGER"},
                    "prompt": {"type": "STRING"},
                },
                "required": ["output_index", "prompt"],
            },
        }
    },
    "required": ["prompts"],
}


class GeminiClient:
    """Small dependency-free Gemini generateContent REST client."""

    def __init__(
        self,
        api_key: str,
        *,
        model: str = DEFAULT_GEMINI_MODEL,
        base_url: str = DEFAULT_GEMINI_BASE_URL,
        timeout_s: float = 120.0,
    ) -> None:
        if not api_key.strip():
            raise ValueError("Gemini API key cannot be empty.")
        self.api_key = api_key.strip()
        self.model = model.strip()
        self.base_url = base_url.rstrip("/")
        self.timeout_s = timeout_s

    def generate_json(
        self,
        parts: Sequence[dict[str, Any]],
        *,
        response_schema: dict[str, Any],
        temperature: float = 0.4,
    ) -> Any:
        model = urllib.parse.quote(self.model, safe="-._")
        key = urllib.parse.quote(self.api_key, safe="")
        url = f"{self.base_url}/models/{model}:generateContent?key={key}"
        body = {
            "contents": [{"role": "user", "parts": list(parts)}],
            "generationConfig": {
                "temperature": temperature,
                "responseMimeType": "application/json",
                "responseSchema": response_schema,
            },
        }
        request = urllib.request.Request(
            url,
            data=json.dumps(body).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=self.timeout_s) as response:
                payload = json.load(response)
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"Gemini API returned HTTP {exc.code}: {detail}") from exc
        except urllib.error.URLError as exc:
            raise RuntimeError(f"Could not reach Gemini API: {exc.reason}") from exc

        try:
            text = payload["candidates"][0]["content"]["parts"][0]["text"]
            return json.loads(text)
        except (KeyError, IndexError, TypeError, json.JSONDecodeError) as exc:
            raise RuntimeError(f"Gemini returned an unexpected response: {payload}") from exc


def _caption_text(row: Any) -> str:
    if isinstance(row, str):
        return row.strip()
    if not isinstance(row, dict):
        return ""

    # ACE temporal output stores the complete model answer in `caption`.
    for key in ("caption", "summary", "music_caption", "ace_raw", "text"):
        value = row.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    parsed = row.get("parsed")
    if isinstance(parsed, dict):
        return _caption_text(parsed)
    for key in ("parsed_json", "ace_json", "final"):
        nested = row.get(key)
        if isinstance(nested, dict):
            text = _caption_text(nested)
            if text:
                return text
    return ""


def _optional_float(row: dict[str, Any], *keys: str) -> float | None:
    for key in keys:
        value = row.get(key)
        if value is not None and value != "":
            try:
                return float(value)
            except (TypeError, ValueError):
                pass
    return None


def load_audio_captions(path: str | Path) -> list[AudioCaption]:
    """Load ACE JSONL, a JSON list, or a plain-text caption list."""
    source = Path(path)
    if not source.is_file():
        raise FileNotFoundError(f"Audio caption file does not exist: {source}")

    if source.suffix.lower() == ".json":
        payload = json.loads(source.read_text(encoding="utf-8"))
        rows = payload.get("captions", []) if isinstance(payload, dict) else payload
    elif source.suffix.lower() == ".jsonl":
        rows = [
            json.loads(line)
            for line in source.read_text(encoding="utf-8").splitlines()
            if line.strip()
        ]
    else:
        rows = [line for line in source.read_text(encoding="utf-8").splitlines() if line.strip()]

    captions: list[AudioCaption] = []
    for row in rows:
        text = _caption_text(row)
        if not text:
            continue
        mapping = row if isinstance(row, dict) else {}
        timing = mapping.get("time") if isinstance(mapping.get("time"), dict) else mapping
        if isinstance(mapping.get("final"), dict):
            final_timing = mapping["final"].get("time")
            if isinstance(final_timing, dict):
                timing = final_timing
        captions.append(
            AudioCaption(
                text=text,
                start_s=_optional_float(timing, "t0", "start_s", "start"),
                end_s=_optional_float(timing, "t1", "end_s", "end"),
            )
        )
    if not captions:
        raise ValueError(f"No non-empty captions found in {source}.")
    return captions


def caption_audio_with_ace(
    audio_path: str | Path,
    *,
    out_dir: str | Path,
    python_path: str | Path = DEFAULT_ACE_PYTHON,
    ace_script: str | Path = DEFAULT_ACE_SCRIPT,
    window_s: float = 30.0,
    hop_s: float = 8.0,
    profile: str = "visual_json",
) -> list[AudioCaption]:
    """Run the existing ACE captioner and load its generated sequence."""
    audio = Path(audio_path).resolve()
    output = Path(out_dir).resolve()
    python = Path(python_path).resolve()
    script = Path(ace_script).resolve()
    if not audio.is_file():
        raise FileNotFoundError(f"Audio file does not exist: {audio}")
    if not python.is_file():
        raise FileNotFoundError(
            f"ACE Python environment does not exist: {python}. Rebuild the dev container, or run "
            f"VENV_DIR={python.parent.parent} bash ace/install.sh ace, or pass --ace-python."
        )
    if not script.is_file():
        raise FileNotFoundError(f"ACE caption script does not exist: {script}")
    if window_s <= 0 or hop_s <= 0:
        raise ValueError("ACE window and hop durations must be positive.")

    command = [
        str(python),
        str(script),
        str(audio),
        "--out-dir",
        str(output),
        "--window-s",
        str(window_s),
        "--hop-s",
        str(hop_s),
        "--profile",
        profile,
    ]
    try:
        subprocess.run(command, cwd=script.parent, check=True)
    except subprocess.CalledProcessError as exc:
        raise RuntimeError(f"ACE caption generation failed with exit code {exc.returncode}.") from exc
    return load_audio_captions(output / "captions.jsonl")


def load_image_descriptions(path: str | Path) -> list[str]:
    source = Path(path)
    if not source.is_file():
        raise FileNotFoundError(f"Image description file does not exist: {source}")
    if source.suffix.lower() == ".json":
        payload = json.loads(source.read_text(encoding="utf-8"))
        rows = payload.get("descriptions", []) if isinstance(payload, dict) else payload
    else:
        rows = source.read_text(encoding="utf-8").splitlines()
    descriptions = [str(row).strip() for row in rows if str(row).strip()]
    if not descriptions:
        raise ValueError(f"No image descriptions found in {source}.")
    return descriptions


def describe_image_variants(
    client: GeminiClient,
    image_path: str | Path,
    *,
    count: int,
) -> list[str]:
    if count < 1:
        raise ValueError("Image variant count must be at least 1.")
    source = Path(image_path)
    if not source.is_file():
        raise FileNotFoundError(f"Reference image does not exist: {source}")
    mime_type = mimetypes.guess_type(source.name)[0] or "image/jpeg"
    image_data = base64.b64encode(source.read_bytes()).decode("ascii")
    instruction = (
        f"Analyze this reference image and return exactly {count} concise narrative visual "
        "descriptions. Preserve its recognizable art direction: medium, palette, lighting, "
        "composition, texture, lens/perspective, and mood. Make each description a distinct "
        "story-compatible variation, without mentioning that a reference image exists."
    )
    payload = client.generate_json(
        [
            {"text": instruction},
            {"inlineData": {"mimeType": mime_type, "data": image_data}},
        ],
        response_schema=IMAGE_VARIANTS_SCHEMA,
    )
    descriptions = [str(value).strip() for value in payload.get("descriptions", []) if str(value).strip()]
    if len(descriptions) != count:
        raise RuntimeError(f"Gemini returned {len(descriptions)} image variants; expected {count}.")
    return descriptions


def align_sequences(
    audio_captions: Sequence[AudioCaption],
    image_descriptions: Sequence[str],
) -> list[PromptPair]:
    """Stretch the shorter sequence evenly over the longer sequence's timeline."""
    if not audio_captions:
        raise ValueError("At least one audio caption is required.")
    if not image_descriptions:
        raise ValueError("At least one image description is required.")

    output_count = max(len(audio_captions), len(image_descriptions))

    def source_index(output_index: int, source_count: int) -> int:
        return min((output_index * source_count) // output_count, source_count - 1)

    pairs = []
    for output_index in range(output_count):
        audio_index = source_index(output_index, len(audio_captions))
        image_index = source_index(output_index, len(image_descriptions))
        pairs.append(
            PromptPair(
                output_index=output_index,
                audio_index=audio_index,
                image_index=image_index,
                audio_caption=audio_captions[audio_index],
                image_description=image_descriptions[image_index],
            )
        )
    return pairs


def merge_prompt_pairs(client: GeminiClient, pairs: Sequence[PromptPair]) -> list[GeneratedPrompt]:
    if not pairs:
        return []
    inputs = [
        {
            "output_index": pair.output_index,
            "audio_caption": pair.audio_caption.text,
            "image_style_and_narrative": pair.image_description,
        }
        for pair in pairs
    ]
    instruction = (
        "You write production-ready prompts for a text-to-image model. For every input item, "
        "merge the audio caption's subject, action, rhythm, and emotional progression with the "
        "visual description's art direction. Preserve concrete visual details and temporal "
        "continuity, but never mention audio, music, captions, prompts, or a reference image. "
        "Return exactly one vivid standalone prompt per item, in the same order and with the "
        "same output_index. Do not add camera motion or text/lettering unless requested by the input.\n\n"
        f"INPUT ITEMS:\n{json.dumps(inputs, ensure_ascii=False)}"
    )
    payload = client.generate_json(
        [{"text": instruction}],
        response_schema=MERGED_PROMPTS_SCHEMA,
        temperature=0.5,
    )
    generated = payload.get("prompts", [])
    by_index = {
        int(item["output_index"]): str(item["prompt"]).strip()
        for item in generated
        if isinstance(item, dict) and "output_index" in item and str(item.get("prompt", "")).strip()
    }
    expected = {pair.output_index for pair in pairs}
    if set(by_index) != expected:
        raise RuntimeError(
            "Gemini did not return exactly one merged prompt for every aligned pair "
            f"(expected {sorted(expected)}, received {sorted(by_index)})."
        )

    return [
        GeneratedPrompt(
            output_index=pair.output_index,
            audio_index=pair.audio_index,
            image_index=pair.image_index,
            start_s=pair.audio_caption.start_s,
            end_s=pair.audio_caption.end_s,
            audio_caption=pair.audio_caption.text,
            image_description=pair.image_description,
            prompt=by_index[pair.output_index],
        )
        for pair in pairs
    ]


def build_prompt_sequence(
    client: GeminiClient,
    audio_captions: Sequence[AudioCaption],
    *,
    image_path: str | Path | None = None,
    image_descriptions: Sequence[str] | None = None,
    image_variant_count: int | None = None,
) -> list[GeneratedPrompt]:
    if image_descriptions is None:
        if image_path is None:
            raise ValueError("Provide either an image or existing image descriptions.")
        descriptions = describe_image_variants(
            client,
            image_path,
            count=image_variant_count or len(audio_captions),
        )
    else:
        descriptions = [value.strip() for value in image_descriptions if value.strip()]
    return merge_prompt_pairs(client, align_sequences(audio_captions, descriptions))


def write_jsonl(rows: Iterable[GeneratedPrompt], destination: str | Path) -> None:
    output = Path(destination)
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("w", encoding="utf-8") as handle:
        for row in rows:
            handle.write(json.dumps(asdict(row), ensure_ascii=False) + "\n")


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    audio_source = parser.add_mutually_exclusive_group(required=True)
    audio_source.add_argument("--audio", help="Audio file to caption in fixed windows with ACE.")
    audio_source.add_argument(
        "--audio-captions",
        help="Existing ACE JSONL/JSON or one caption per line (skips ACE inference).",
    )
    image_source = parser.add_mutually_exclusive_group(required=True)
    image_source.add_argument("--image", help="Reference image to analyze with Gemini.")
    image_source.add_argument(
        "--image-descriptions",
        help="Existing JSON or one-description-per-line file (skips image analysis).",
    )
    parser.add_argument("--image-variants", type=int, default=None)
    parser.add_argument("--caption-out-dir", default="ace_prompt_captions")
    parser.add_argument("--caption-window-s", type=float, default=30.0)
    parser.add_argument("--caption-hop-s", type=float, default=8.0)
    parser.add_argument("--caption-profile", default="visual_json")
    parser.add_argument(
        "--ace-python",
        default=str(DEFAULT_ACE_PYTHON),
        help="Python executable from the installed ACE environment.",
    )
    parser.add_argument("--out", default="prompt_sequence.jsonl")
    parser.add_argument("--model", default=os.environ.get("GEMINI_MODEL", DEFAULT_GEMINI_MODEL))
    parser.add_argument("--api-key", default=os.environ.get("GEMINI_API_KEY"))
    parser.add_argument("--timeout-s", type=float, default=120.0)
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv)
    if not args.api_key:
        print("Set GEMINI_API_KEY or pass --api-key.", file=sys.stderr)
        return 2
    try:
        captions = (
            load_audio_captions(args.audio_captions)
            if args.audio_captions
            else caption_audio_with_ace(
                args.audio,
                out_dir=args.caption_out_dir,
                python_path=args.ace_python,
                window_s=args.caption_window_s,
                hop_s=args.caption_hop_s,
                profile=args.caption_profile,
            )
        )
        descriptions = (
            load_image_descriptions(args.image_descriptions) if args.image_descriptions else None
        )
        client = GeminiClient(args.api_key, model=args.model, timeout_s=args.timeout_s)
        prompts = build_prompt_sequence(
            client,
            captions,
            image_path=args.image,
            image_descriptions=descriptions,
            image_variant_count=args.image_variants,
        )
        write_jsonl(prompts, args.out)
    except (OSError, ValueError, RuntimeError, json.JSONDecodeError) as exc:
        print(f"Prompt pipeline failed: {exc}", file=sys.stderr)
        return 1
    print(f"Wrote {len(prompts)} image-generation prompts to {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
