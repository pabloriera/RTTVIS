from __future__ import annotations

import asyncio
import base64
import logging
import os
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from io import BytesIO
from typing import Any


DEFAULT_MODEL_ID = "stabilityai/sd-turbo"
DEFAULT_MODEL_KEY = "sd-turbo"
Z_IMAGE_MODEL_ID = "Tongyi-MAI/Z-Image-Turbo"
Z_IMAGE_MODEL_KEY = "z-image-turbo"
LUMINA_MODEL_ID = "Alpha-VLLM/Lumina-Image-2.0"
LUMINA_MODEL_KEY = "lumina-image-2"
MODEL_ALIASES = {
    DEFAULT_MODEL_KEY: DEFAULT_MODEL_KEY,
    DEFAULT_MODEL_ID: DEFAULT_MODEL_KEY,
    Z_IMAGE_MODEL_KEY: Z_IMAGE_MODEL_KEY,
    Z_IMAGE_MODEL_ID: Z_IMAGE_MODEL_KEY,
    LUMINA_MODEL_KEY: LUMINA_MODEL_KEY,
    LUMINA_MODEL_ID: LUMINA_MODEL_KEY,
}
WARMUP_PROMPT = "a simple warmup image"
PROMPT_CONDITIONING_MODES = {"prompt", "embeds"}
DEFAULT_PROMPT_CONDITIONING_MODE = "prompt"
BATCH_PERTURBATION_SCALE = 0.01

logger = logging.getLogger(__name__)


class UnsupportedModelError(ValueError):
    """Raised when an image model is configured before its adapter exists."""


@dataclass(frozen=True)
class ImageModelSpec:
    key: str
    label: str
    model_id: str
    model_dir: str
    adapter: str
    width: int
    height: int
    num_inference_steps: int
    guidance_scale: float
    dtype: str | None = None

    def public_dict(self) -> dict[str, Any]:
        return {
            "id": self.key,
            "label": self.label,
            "model_id": self.model_id,
            "width": self.width,
            "height": self.height,
            "num_inference_steps": self.num_inference_steps,
            "guidance_scale": self.guidance_scale,
            "adapter": self.adapter,
        }


@dataclass(frozen=True)
class ImageGenerationConfig:
    default_model_key: str
    model_specs: dict[str, ImageModelSpec]
    device: str
    dtype: str
    width: int
    height: int
    num_inference_steps: int
    guidance_scale: float
    prompt_conditioning_mode: str
    token: str | None

    def public_dict(self) -> dict[str, Any]:
        default_model = self.model_specs[self.default_model_key]
        return {
            "model_id": default_model.model_id,
            "model_dir": default_model.model_dir,
            "default_model_id": self.default_model_key,
            "available_models": [spec.public_dict() for spec in self.model_specs.values()],
            "device": self.device,
            "dtype": self.dtype,
            "width": self.width,
            "height": self.height,
            "num_inference_steps": self.num_inference_steps,
            "guidance_scale": self.guidance_scale,
            "prompt_conditioning_mode": self.prompt_conditioning_mode,
        }


@dataclass(frozen=True)
class GenerationResult:
    job_id: int
    stale: bool
    image_png_base64: str | None
    images_png_base64: list[str] | None
    elapsed_ms: int


@dataclass(frozen=True)
class GenerationSettings:
    model_key: str
    width: int
    height: int
    num_inference_steps: int
    guidance_scale: float
    seed: int | None
    prompt_walk: PromptWalkSettings | None = None
    prompt_blend: PromptBlendSettings | None = None
    batch_size: int = 1
    batch_walk: bool = False
    batch_walk_scale: float = 0.01


@dataclass(frozen=True)
class PromptBlendSettings:
    prompt: str
    weight: float


@dataclass(frozen=True)
class PromptWalkSettings:
    step: int
    seed: int
    scale: float = 0.01
    momentum: float = 0.92
    turn_scale: float = 0.35


class PromptConditioner:
    def __init__(self, mode: str, device: str) -> None:
        self.mode = mode
        self.device = device

    def build_kwargs(
        self,
        pipeline: Any,
        prompt: str,
        *,
        guidance_scale: float,
        prompt_walk: PromptWalkSettings | None = None,
        prompt_blend: PromptBlendSettings | None = None,
        num_images_per_prompt: int = 1,
        batch_walk: bool = False,
        batch_walk_scale: float = 0.01,
    ) -> dict[str, Any]:
        if self.mode == "prompt" and prompt_walk is None and prompt_blend is None and not batch_walk:
            return {"prompt": prompt}
        if self.mode == "embeds" or prompt_walk is not None or prompt_blend is not None or batch_walk:
            return self._build_prompt_embed_kwargs(
                pipeline,
                prompt,
                guidance_scale=guidance_scale,
                prompt_walk=prompt_walk,
                prompt_blend=prompt_blend,
                num_images_per_prompt=num_images_per_prompt,
                batch_walk=batch_walk,
                batch_walk_scale=batch_walk_scale,
            )
        raise ValueError(f"Unsupported prompt conditioning mode: {self.mode}.")

    def _build_prompt_embed_kwargs(
        self,
        pipeline: Any,
        prompt: str,
        *,
        guidance_scale: float,
        prompt_walk: PromptWalkSettings | None,
        prompt_blend: PromptBlendSettings | None,
        num_images_per_prompt: int,
        batch_walk: bool = False,
        batch_walk_scale: float = 0.01,
    ) -> dict[str, Any]:
        do_classifier_free_guidance = guidance_scale > 1
        prompt_embeds, negative_prompt_embeds = self._encode_prompt_embeds(
            pipeline,
            prompt,
            device=self.device,
            num_images_per_prompt=num_images_per_prompt,
            do_classifier_free_guidance=do_classifier_free_guidance,
        )
        extra_prompt_embeds = None
        if prompt_blend is not None:
            extra_prompt_embeds, _ = self._encode_prompt_embeds(
                pipeline,
                prompt_blend.prompt,
                device=self.device,
                num_images_per_prompt=num_images_per_prompt,
                do_classifier_free_guidance=do_classifier_free_guidance,
            )
        prompt_embeds = self.transform_prompt_embeds(
            prompt_embeds,
            prompt_walk=prompt_walk,
            prompt_blend=prompt_blend,
            extra_prompt_embeds=extra_prompt_embeds,
            batch_walk=batch_walk,
            batch_walk_scale=batch_walk_scale,
        )
        negative_prompt_embeds = self._pad_prompt_embeds_like(
            negative_prompt_embeds,
            prompt_embeds,
        )
        return {
            "prompt": None,
            "prompt_embeds": prompt_embeds,
            "negative_prompt_embeds": negative_prompt_embeds,
        }

    @staticmethod
    def _encode_prompt_embeds(pipeline: Any, prompt: str, **kwargs: Any) -> tuple[Any, Any]:
        result = pipeline.encode_prompt(prompt, **kwargs)
        if isinstance(result, dict):
            return result.get("prompt_embeds"), result.get("negative_prompt_embeds")
        if isinstance(result, tuple):
            if len(result) < 2:
                return result[0], None
            return result[0], result[1]
        return result, None

    def transform_prompt_embeds(
        self,
        prompt_embeds: Any,
        *,
        prompt_walk: PromptWalkSettings | None = None,
        prompt_blend: PromptBlendSettings | None = None,
        extra_prompt_embeds: Any | None = None,
        batch_walk: bool = False,
        batch_walk_scale: float = 0.01,
    ) -> Any:
        # Isolated hook for custom vector arithmetic.
        if prompt_blend is not None and extra_prompt_embeds is not None:
            prompt_embeds = self._interpolate_prompt_embeds(
                prompt_embeds,
                extra_prompt_embeds,
                prompt_blend.weight,
            )
        if prompt_walk is not None:
            if isinstance(prompt_embeds, list):
                offsets = self._random_walk_offsets(prompt_embeds, prompt_walk)
                prompt_embeds = [embed + offset for embed, offset in zip(prompt_embeds, offsets)]
            else:
                prompt_embeds = prompt_embeds + self._random_walk_offset(prompt_embeds, prompt_walk)

        if batch_walk:
            prompt_embeds = self._perturb_batch(prompt_embeds, scale=batch_walk_scale)

        return prompt_embeds

    def _perturb_batch(
        self,
        prompt_embeds: Any,
        *,
        scale: float = 0.01,
    ) -> Any:
        """Add a deterministic, independent perturbation to every batch item."""
        import torch

        if isinstance(prompt_embeds, list):
            if not prompt_embeds:
                return prompt_embeds
            generator = torch.Generator(device=prompt_embeds[0].device).manual_seed(0)
            return [
                embed + self._scaled_noise(embed, generator, scale)
                for embed in prompt_embeds
            ]

        if prompt_embeds is None or prompt_embeds.shape[0] == 0:
            return prompt_embeds

        generator = torch.Generator(device=prompt_embeds.device).manual_seed(0)
        return self._torch_cat(
            [
                embed + self._scaled_noise(embed, generator, scale)
                for embed in prompt_embeds.split(1, dim=0)
            ],
            dim=0,
        )

    def _scaled_noise(self, reference: Any, generator: Any, scale: float) -> Any:
        magnitude = (reference.float().norm().clamp_min(1e-8) * scale).to(
            device=reference.device,
            dtype=reference.dtype,
        )
        return self._normalized_noise(reference, generator) * magnitude

    def _interpolate_prompt_embeds(
        self,
        prompt_embeds: Any,
        extra_prompt_embeds: Any,
        alpha: float,
    ) -> Any:
        if isinstance(prompt_embeds, list) and isinstance(extra_prompt_embeds, list):
            return [
                self._interpolate_prompt_embed_list_pair(embed, extra_embed, alpha)
                for embed, extra_embed in zip(prompt_embeds, extra_prompt_embeds)
            ]

        return self._interpolate_prompt_embed_pair(prompt_embeds, extra_prompt_embeds, alpha)

    def _interpolate_prompt_embed_list_pair(
        self,
        prompt_embed: Any,
        extra_prompt_embed: Any,
        alpha: float,
    ) -> Any:
        if prompt_embed.shape == extra_prompt_embed.shape:
            return alpha * prompt_embed + (1 - alpha) * extra_prompt_embed
        if len(prompt_embed.shape) != len(extra_prompt_embed.shape):
            raise ValueError(
                "Prompt embeddings must have the same number of dimensions to interpolate; "
                f"got {tuple(prompt_embed.shape)} and {tuple(extra_prompt_embed.shape)}."
            )

        shared_length = min(prompt_embed.shape[0], extra_prompt_embed.shape[0])
        blended = alpha * prompt_embed[:shared_length] + (1 - alpha) * extra_prompt_embed[:shared_length]
        if prompt_embed.shape[0] > shared_length:
            return self._torch_cat(
                [blended, alpha * prompt_embed[shared_length:]],
                dim=0,
            )
        if extra_prompt_embed.shape[0] > shared_length:
            return self._torch_cat(
                [blended, (1 - alpha) * extra_prompt_embed[shared_length:]],
                dim=0,
            )
        return blended

    def _interpolate_prompt_embed_pair(
        self,
        prompt_embed: Any,
        extra_prompt_embed: Any,
        alpha: float,
    ) -> Any:
        return self._torch_cat([prompt_embed, extra_prompt_embed], dim=1)

    @staticmethod
    def _pad_prompt_embed_pair(prompt_embed: Any, extra_prompt_embed: Any) -> tuple[Any, Any]:
        if prompt_embed.shape == extra_prompt_embed.shape:
            return prompt_embed, extra_prompt_embed
        if len(prompt_embed.shape) != len(extra_prompt_embed.shape):
            raise ValueError(
                "Prompt embeddings must have the same number of dimensions to interpolate; "
                f"got {tuple(prompt_embed.shape)} and {tuple(extra_prompt_embed.shape)}."
            )

        target_shape = tuple(
            max(prompt_size, extra_size)
            for prompt_size, extra_size in zip(prompt_embed.shape, extra_prompt_embed.shape)
        )
        return (
            PromptConditioner._pad_prompt_embed(prompt_embed, target_shape),
            PromptConditioner._pad_prompt_embed(extra_prompt_embed, target_shape),
        )

    @staticmethod
    def _pad_prompt_embed(prompt_embed: Any, target_shape: tuple[int, ...]) -> Any:
        if tuple(prompt_embed.shape) == target_shape:
            return prompt_embed

        padded = prompt_embed.new_zeros(target_shape)
        slices = tuple(slice(0, size) for size in prompt_embed.shape)
        padded[slices] = prompt_embed
        return padded

    @staticmethod
    def _pad_prompt_embeds_like(prompt_embeds: Any, reference_embeds: Any) -> Any:
        if prompt_embeds is None:
            return None
        if isinstance(prompt_embeds, list) and isinstance(reference_embeds, list):
            return [
                PromptConditioner._pad_prompt_embed(embed, tuple(reference.shape))
                for embed, reference in zip(prompt_embeds, reference_embeds)
            ]
        return PromptConditioner._pad_prompt_embed(prompt_embeds, tuple(reference_embeds.shape))

    @staticmethod
    def _torch_cat(tensors: list[Any], *, dim: int) -> Any:
        import torch

        return torch.cat(tensors, dim=dim)

    def _random_walk_offset(self, prompt_embeds: Any, prompt_walk: PromptWalkSettings) -> Any:
        import torch

        generator = torch.Generator(device=prompt_embeds.device).manual_seed(prompt_walk.seed)
        direction = self._normalized_noise(prompt_embeds, generator)
        offset = prompt_embeds.new_zeros(prompt_embeds.shape)
        step_scale = (
            prompt_embeds.float().norm().clamp_min(1e-8) * prompt_walk.scale
        ).to(device=prompt_embeds.device, dtype=prompt_embeds.dtype)

        for _ in range(prompt_walk.step + 1):
            offset = offset + direction * step_scale
            turn = self._normalized_noise(prompt_embeds, generator)
            direction = self._normalize(direction * prompt_walk.momentum + turn * prompt_walk.turn_scale)

        return offset

    def _random_walk_offsets(self, prompt_embeds: list[Any], prompt_walk: PromptWalkSettings) -> list[Any]:
        import torch

        if not prompt_embeds:
            return []

        generator = torch.Generator(device=prompt_embeds[0].device).manual_seed(prompt_walk.seed)
        direction = self._normalized_noise_list(prompt_embeds, generator)
        offsets = [embed.new_zeros(embed.shape) for embed in prompt_embeds]
        step_scale = (
            self._global_norm(prompt_embeds).clamp_min(1e-8) * prompt_walk.scale
        ).to(device=prompt_embeds[0].device, dtype=prompt_embeds[0].dtype)

        for _ in range(prompt_walk.step + 1):
            offsets = [offset + part * step_scale for offset, part in zip(offsets, direction)]
            turn = self._normalized_noise_list(prompt_embeds, generator)
            direction = self._normalize_list(
                [
                    part * prompt_walk.momentum + turn_part * prompt_walk.turn_scale
                    for part, turn_part in zip(direction, turn)
                ]
            )

        return offsets

    @staticmethod
    def _normalized_noise(reference: Any, generator: Any) -> Any:
        import torch

        noise = torch.randn(
            reference.shape,
            generator=generator,
            device=reference.device,
            dtype=reference.dtype,
        )
        return PromptConditioner._normalize(noise)

    @staticmethod
    def _normalized_noise_list(references: list[Any], generator: Any) -> list[Any]:
        import torch

        noise = [
            torch.randn(
                reference.shape,
                generator=generator,
                device=reference.device,
                dtype=reference.dtype,
            )
            for reference in references
        ]
        return PromptConditioner._normalize_list(noise)

    @staticmethod
    def _normalize(vector: Any) -> Any:
        norm = vector.float().norm().clamp_min(1e-8)
        return vector / norm.to(device=vector.device, dtype=vector.dtype)

    @staticmethod
    def _normalize_list(vectors: list[Any]) -> list[Any]:
        norm = PromptConditioner._global_norm(vectors).clamp_min(1e-8)
        return [vector / norm.to(device=vector.device, dtype=vector.dtype) for vector in vectors]

    @staticmethod
    def _global_norm(vectors: list[Any]) -> Any:
        norm_squared = sum(vector.float().pow(2).sum() for vector in vectors)
        return norm_squared.sqrt()


class ImageModelAdapter:
    def __init__(self, spec: ImageModelSpec, config: ImageGenerationConfig) -> None:
        self.spec = spec
        self.config = config
        self.pipeline: Any | None = None
        self.torch: Any | None = None

    def load(self) -> None:
        raise NotImplementedError

    def warmup(self) -> None:
        generator = self.create_generator(0)
        self.render(
            WARMUP_PROMPT,
            GenerationSettings(
                model_key=self.spec.key,
                width=self.spec.width,
                height=self.spec.height,
                num_inference_steps=self.spec.num_inference_steps,
                guidance_scale=self.spec.guidance_scale,
                seed=0,
            ),
            generator=generator,
        )

    def render(
        self,
        prompt: str,
        settings: GenerationSettings,
        *,
        generator: Any | None,
    ) -> Any:
        raise NotImplementedError

    def close(self) -> None:
        self.pipeline = None
        self.torch = None

    def create_generator(self, seed: int | None, batch_size: int = 1, same_seed: bool = False) -> Any | None:
        if seed is None:
            return None
        self.load()
        if self.torch is None:
            raise RuntimeError("Torch did not initialize.")
        generator_device = self.config.device if self.config.device.startswith("cuda") else "cpu"
        
        if batch_size == 1:
            return self.torch.Generator(device=generator_device).manual_seed(seed)
            
        if same_seed:
            return [self.torch.Generator(device=generator_device).manual_seed(seed) for _ in range(batch_size)]
            
        return [
            self.torch.Generator(device=generator_device).manual_seed(seed + i) 
            for i in range(batch_size)
        ]

    def _model_source(self) -> str:
        if os.path.isfile(os.path.join(self.spec.model_dir, "model_index.json")):
            return self.spec.model_dir
        return self.spec.model_id


class StableDiffusionAdapter(ImageModelAdapter):
    def __init__(self, spec: ImageModelSpec, config: ImageGenerationConfig) -> None:
        super().__init__(spec, config)
        self._prompt_conditioner = PromptConditioner(
            config.prompt_conditioning_mode,
            config.device,
        )

    def load(self) -> None:
        if self.pipeline is not None:
            return

        try:
            import torch
            from diffusers import AutoPipelineForText2Image
        except ImportError as exc:
            raise RuntimeError(
                "Image runtime is not installed. Run: bash scripts/download-assets.sh"
            ) from exc

        self._check_cuda(torch)
        torch_dtype = self._resolve_torch_dtype(torch, self.config.dtype)
        load_kwargs: dict[str, Any] = {
            "torch_dtype": torch_dtype,
            "token": self.config.token,
        }
        if self.config.dtype == "float16":
            load_kwargs["variant"] = "fp16"

        try:
            pipeline = AutoPipelineForText2Image.from_pretrained(
                self._model_source(),
                **load_kwargs,
            )
        except (OSError, ValueError):
            load_kwargs.pop("variant", None)
            pipeline = AutoPipelineForText2Image.from_pretrained(
                self._model_source(),
                **load_kwargs,
            )

        pipeline = pipeline.to(self.config.device)
        if hasattr(pipeline, "set_progress_bar_config"):
            pipeline.set_progress_bar_config(disable=True)

        self.pipeline = pipeline
        self.torch = torch

    def render(
        self,
        prompt: str,
        settings: GenerationSettings,
        *,
        generator: Any | None,
    ) -> Any:
        self.load()
        if self.pipeline is None:
            raise RuntimeError("Image pipeline did not initialize.")
        prompt_kwargs = self._prompt_conditioner.build_kwargs(
            self.pipeline,
            prompt,
            guidance_scale=settings.guidance_scale,
            prompt_walk=settings.prompt_walk,
            prompt_blend=settings.prompt_blend,
            num_images_per_prompt=settings.batch_size,
            batch_walk=settings.batch_walk,
            batch_walk_scale=settings.batch_walk_scale,
        )
        # encode_prompt has already expanded embedding batches. Asking the pipeline
        # to expand them again would create batch_size squared conditioning vectors.
        pipeline_batch_size = 1 if "prompt_embeds" in prompt_kwargs else settings.batch_size
        return self.pipeline(
            **prompt_kwargs,
            width=settings.width,
            height=settings.height,
            num_inference_steps=settings.num_inference_steps,
            guidance_scale=settings.guidance_scale,
            generator=generator,
            num_images_per_prompt=pipeline_batch_size,
        ).images

    def _check_cuda(self, torch: Any) -> None:
        if self.config.device.startswith("cuda") and not torch.cuda.is_available():
            visible_devices = os.environ.get("NVIDIA_VISIBLE_DEVICES", "<unset>")
            driver_capabilities = os.environ.get("NVIDIA_DRIVER_CAPABILITIES", "<unset>")
            cuda_device_count = torch.cuda.device_count()
            raise RuntimeError(
                "CUDA was requested for image generation, but PyTorch cannot see a CUDA GPU. "
                f"torch.cuda.is_available() is false; torch.cuda.device_count()={cuda_device_count}; "
                f"NVIDIA_VISIBLE_DEVICES={visible_devices}; "
                f"NVIDIA_DRIVER_CAPABILITIES={driver_capabilities}. "
                "Check that the host NVIDIA driver is healthy, that `nvidia-smi` works on the host, "
                "and that this devcontainer was recreated with GPU support (`--gpus all`)."
            )

    @staticmethod
    def _resolve_torch_dtype(torch: Any, dtype: str) -> Any:
        dtypes = {
            "float16": torch.float16,
            "bfloat16": torch.bfloat16,
            "float32": torch.float32,
        }
        try:
            return dtypes[dtype]
        except KeyError as exc:
            raise ValueError(
                "IMAGE_GENERATION_DTYPE must be one of float16, bfloat16, or float32."
            ) from exc


class ZImageTurboAdapter(ImageModelAdapter):
    def __init__(self, spec: ImageModelSpec, config: ImageGenerationConfig) -> None:
        super().__init__(spec, config)
        self._prompt_conditioner = PromptConditioner("embeds", config.device)

    def load(self) -> None:
        if self.pipeline is not None:
            return
        if not os.path.isfile(os.path.join(self.spec.model_dir, "model_index.json")):
            raise RuntimeError(
                f"{self.spec.label} is not downloaded at {self.spec.model_dir}. "
                "Run: DOWNLOAD_Z_IMAGE_MODEL=1 bash scripts/download-assets.sh"
            )

        try:
            import torch
            from diffusers import DiffusionPipeline
        except ImportError as exc:
            raise RuntimeError(
                "Z-Image runtime is not installed. Run: bash scripts/download-assets.sh"
            ) from exc

        StableDiffusionAdapter._check_cuda(self, torch)
        torch_dtype = StableDiffusionAdapter._resolve_torch_dtype(
            torch,
            self.spec.dtype or "bfloat16",
        )
        pipeline = DiffusionPipeline.from_pretrained(
            self._model_source(),
            torch_dtype=torch_dtype,
            token=self.config.token,
        )
        pipeline = pipeline.to(self.config.device)
        if hasattr(pipeline, "set_progress_bar_config"):
            pipeline.set_progress_bar_config(disable=True)

        self.pipeline = pipeline
        self.torch = torch

    def render(
        self,
        prompt: str,
        settings: GenerationSettings,
        *,
        generator: Any | None,
    ) -> Any:
        self.load()
        if self.pipeline is None:
            raise RuntimeError("Z-Image pipeline did not initialize.")

        effective_prompt = prompt
        
        # In ZImage model, the blending should be concatenating sequence to make a larger sequence
        # We need to construct the embeds manually if blend is requested
        if settings.prompt_blend is not None or settings.prompt_walk is not None or settings.batch_walk:
            
            prompt_embeds, negative_prompt_embeds = PromptConditioner._encode_prompt_embeds(
                self.pipeline,
                [prompt] * settings.batch_size,
                device=self.config.device,
                do_classifier_free_guidance=settings.guidance_scale > 0,
                max_sequence_length=512,
            )
            
            if settings.prompt_blend is not None:
                blend_prompt_embeds, blend_negative_prompt_embeds = PromptConditioner._encode_prompt_embeds(
                    self.pipeline,
                    [settings.prompt_blend.prompt] * settings.batch_size,
                    device=self.config.device,
                    do_classifier_free_guidance=settings.guidance_scale > 0,
                    max_sequence_length=512,
                )
                
                # ZImage expects list of tensors, one per prompt
                if isinstance(prompt_embeds, list) and isinstance(blend_prompt_embeds, list):
                    prompt_embeds = [
                        self._prompt_conditioner._torch_cat([pe, be], dim=0) 
                        for pe, be in zip(prompt_embeds, blend_prompt_embeds)
                    ]
                    if negative_prompt_embeds and blend_negative_prompt_embeds:
                        negative_prompt_embeds = [
                            self._prompt_conditioner._torch_cat([ne, bne], dim=0) 
                            for ne, bne in zip(negative_prompt_embeds, blend_negative_prompt_embeds)
                        ]
                else:
                    prompt_embeds = self._prompt_conditioner._torch_cat([prompt_embeds, blend_prompt_embeds], dim=1)
                    if negative_prompt_embeds is not None and blend_negative_prompt_embeds is not None:
                        negative_prompt_embeds = self._prompt_conditioner._torch_cat([negative_prompt_embeds, blend_negative_prompt_embeds], dim=1)
            
            prompt_embeds = self._prompt_conditioner.transform_prompt_embeds(
                prompt_embeds,
                prompt_walk=settings.prompt_walk,
                batch_walk=settings.batch_walk,
                batch_walk_scale=settings.batch_walk_scale,
            )
            prompt_embeds = self._as_prompt_embed_list(prompt_embeds)
            negative_prompt_embeds = self._as_prompt_embed_list(negative_prompt_embeds)
            logger.warning(
                "Z-Image prompt embeds: prompt=%s negative=%s",
                self._embed_shapes(prompt_embeds),
                self._embed_shapes(negative_prompt_embeds),
            )

            return self.pipeline(
                prompt=None,
                prompt_embeds=prompt_embeds,
                negative_prompt_embeds=negative_prompt_embeds,
                width=settings.width,
                height=settings.height,
                num_inference_steps=settings.num_inference_steps,
                guidance_scale=settings.guidance_scale,
                generator=generator,
                max_sequence_length=512,
                num_images_per_prompt=1,
            ).images
        
        return self.pipeline(
            prompt=effective_prompt,
            width=settings.width,
            height=settings.height,
            num_inference_steps=settings.num_inference_steps,
            guidance_scale=settings.guidance_scale,
            generator=generator,
            max_sequence_length=512,
            num_images_per_prompt=settings.batch_size,
        ).images

    @staticmethod
    def _blend_prompt_text(prompt: str, prompt_blend: PromptBlendSettings) -> str:
        alpha = min(1.0, max(0.0, prompt_blend.weight))
        prompt_2_weight = 1 - alpha
        if prompt_2_weight <= 0:
            return prompt
        if alpha <= 0:
            return prompt_blend.prompt
        return (
            "Blend these visual prompts into one image. "
            f"Prompt 1 influence {alpha:.2f}: {prompt}. "
            f"Prompt 2 influence {prompt_2_weight:.2f}: {prompt_blend.prompt}."
        )

    @staticmethod
    def _embed_shapes(embeds: Any) -> Any:
        if embeds is None:
            return None
        if isinstance(embeds, list):
            return [tuple(embed.shape) for embed in embeds]
        return tuple(embeds.shape)

    @staticmethod
    def _as_prompt_embed_list(embeds: Any) -> list[Any]:
        if embeds is None:
            return []
        if isinstance(embeds, list):
            return embeds
        return [embeds]


class LuminaImageAdapter(ImageModelAdapter):
    def load(self) -> None:
        if self.pipeline is not None:
            return
        if not os.path.isfile(os.path.join(self.spec.model_dir, "model_index.json")):
            raise RuntimeError(
                f"{self.spec.label} is not downloaded at {self.spec.model_dir}. "
                "Run: DOWNLOAD_LUMINA_IMAGE_MODEL=1 bash scripts/download-assets.sh"
            )

        try:
            import torch
            from diffusers import DiffusionPipeline
        except ImportError as exc:
            raise RuntimeError(
                "Lumina runtime is not installed. Run: bash scripts/download-assets.sh"
            ) from exc

        StableDiffusionAdapter._check_cuda(self, torch)
        torch_dtype = StableDiffusionAdapter._resolve_torch_dtype(
            torch,
            self.spec.dtype or "bfloat16",
        )
        pipeline = DiffusionPipeline.from_pretrained(
            self._model_source(),
            torch_dtype=torch_dtype,
            token=self.config.token,
        )
        pipeline = pipeline.to(self.config.device)
        if hasattr(pipeline, "set_progress_bar_config"):
            pipeline.set_progress_bar_config(disable=True)

        self.pipeline = pipeline
        self.torch = torch

    def render(
        self,
        prompt: str,
        settings: GenerationSettings,
        *,
        generator: Any | None,
    ) -> Any:
        if settings.prompt_walk is not None:
            raise RuntimeError("Prompt walk currently supports SD Turbo only.")
        if settings.prompt_blend is not None:
            raise RuntimeError("Additional prompt embeddings currently support SD/Z-Image only.")
        self.load()
        if self.pipeline is None:
            raise RuntimeError("Lumina pipeline did not initialize.")
        return self.pipeline(
            prompt=prompt,
            width=settings.width,
            height=settings.height,
            num_inference_steps=settings.num_inference_steps,
            guidance_scale=settings.guidance_scale,
            generator=generator,
            cfg_trunc_ratio=0.25,
            cfg_normalization=True,
            max_sequence_length=256,
            num_images_per_prompt=settings.batch_size,
        ).images


def _env_int(name: str, default: int, *, minimum: int, maximum: int) -> int:
    raw_value = os.environ.get(name)
    value = default if raw_value in (None, "") else int(raw_value)
    if not minimum <= value <= maximum:
        raise ValueError(f"{name} must be between {minimum} and {maximum}; got {value}.")
    return value


def _env_float(name: str, default: float) -> float:
    raw_value = os.environ.get(name)
    return default if raw_value in (None, "") else float(raw_value)


def _env_choice(name: str, default: str, choices: set[str]) -> str:
    value = os.environ.get(name, default).strip().lower()
    if value not in choices:
        valid_values = ", ".join(sorted(choices))
        raise ValueError(f"{name} must be one of {valid_values}; got {value}.")
    return value


def normalize_model_key(model_id: str | None) -> str:
    value = (model_id or DEFAULT_MODEL_KEY).strip()
    try:
        return MODEL_ALIASES[value]
    except KeyError as exc:
        supported = ", ".join(sorted(MODEL_ALIASES))
        raise UnsupportedModelError(f"Unsupported image model {value!r}. Supported values: {supported}.") from exc


def get_image_config() -> ImageGenerationConfig:
    default_model_key = normalize_model_key(os.environ.get("IMAGE_MODEL_ID", DEFAULT_MODEL_ID))
    sd_width = _env_int("IMAGE_WIDTH", 512, minimum=64, maximum=2048)
    sd_height = _env_int("IMAGE_HEIGHT", 512, minimum=64, maximum=2048)
    sd_steps = _env_int("IMAGE_NUM_INFERENCE_STEPS", 1, minimum=1, maximum=8)
    sd_guidance = _env_float("IMAGE_GUIDANCE_SCALE", 0.0)
    z_width = _env_int("Z_IMAGE_WIDTH", 1024, minimum=64, maximum=2048)
    z_height = _env_int("Z_IMAGE_HEIGHT", 1024, minimum=64, maximum=2048)
    z_steps = _env_int("Z_IMAGE_NUM_INFERENCE_STEPS", 8, minimum=1, maximum=50)
    z_guidance = _env_float("Z_IMAGE_GUIDANCE_SCALE", 0.0)
    z_dtype = os.environ.get("Z_IMAGE_GENERATION_DTYPE", "bfloat16").strip() or "bfloat16"
    lumina_width = _env_int("LUMINA_IMAGE_WIDTH", 1024, minimum=64, maximum=2048)
    lumina_height = _env_int("LUMINA_IMAGE_HEIGHT", 1024, minimum=64, maximum=2048)
    lumina_steps = _env_int("LUMINA_IMAGE_NUM_INFERENCE_STEPS", 50, minimum=1, maximum=50)
    lumina_guidance = _env_float("LUMINA_IMAGE_GUIDANCE_SCALE", 4.0)
    lumina_dtype = os.environ.get("LUMINA_IMAGE_GENERATION_DTYPE", "bfloat16").strip() or "bfloat16"
    model_specs = {
        DEFAULT_MODEL_KEY: ImageModelSpec(
            key=DEFAULT_MODEL_KEY,
            label="SD Turbo",
            model_id=DEFAULT_MODEL_ID,
            model_dir=os.environ.get("IMAGE_MODEL_DIR", "/models/image/sd-turbo").strip()
            or "/models/image/sd-turbo",
            adapter="stable-diffusion",
            width=sd_width,
            height=sd_height,
            num_inference_steps=sd_steps,
            guidance_scale=sd_guidance,
        ),
        Z_IMAGE_MODEL_KEY: ImageModelSpec(
            key=Z_IMAGE_MODEL_KEY,
            label="Z-Image Turbo",
            model_id=os.environ.get("Z_IMAGE_MODEL_ID", Z_IMAGE_MODEL_ID).strip()
            or Z_IMAGE_MODEL_ID,
            model_dir=os.environ.get("Z_IMAGE_MODEL_DIR", "/models/image/z-image-turbo").strip()
            or "/models/image/z-image-turbo",
            adapter="z-image",
            width=z_width,
            height=z_height,
            num_inference_steps=z_steps,
            guidance_scale=z_guidance,
            dtype=z_dtype,
        ),
        LUMINA_MODEL_KEY: ImageModelSpec(
            key=LUMINA_MODEL_KEY,
            label="Lumina Image 2.0",
            model_id=os.environ.get("LUMINA_IMAGE_MODEL_ID", LUMINA_MODEL_ID).strip()
            or LUMINA_MODEL_ID,
            model_dir=os.environ.get("LUMINA_IMAGE_MODEL_DIR", "/models/image/lumina-image-2").strip()
            or "/models/image/lumina-image-2",
            adapter="lumina-image",
            width=lumina_width,
            height=lumina_height,
            num_inference_steps=lumina_steps,
            guidance_scale=lumina_guidance,
            dtype=lumina_dtype,
        ),
    }
    default_spec = model_specs[default_model_key]

    return ImageGenerationConfig(
        default_model_key=default_model_key,
        model_specs=model_specs,
        device=os.environ.get("IMAGE_GENERATION_DEVICE", "cuda").strip() or "cuda",
        dtype=os.environ.get("IMAGE_GENERATION_DTYPE", "float16").strip() or "float16",
        width=default_spec.width,
        height=default_spec.height,
        num_inference_steps=default_spec.num_inference_steps,
        guidance_scale=default_spec.guidance_scale,
        prompt_conditioning_mode=_env_choice(
            "IMAGE_PROMPT_CONDITIONING_MODE",
            DEFAULT_PROMPT_CONDITIONING_MODE,
            PROMPT_CONDITIONING_MODES,
        ),
        token=os.environ.get("HF_TOKEN") or None,
    )


class ImageGenerationWorker:
    def __init__(self, config: ImageGenerationConfig) -> None:
        self.config = config
        self._executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="image-generation")
        self._render_lock = asyncio.Lock()
        self._job_lock = asyncio.Lock()
        self._latest_job_id = 0
        self._active_adapter: ImageModelAdapter | None = None
        self._active_model_key: str | None = None
        self._warmed_up = False
        self._warmup_elapsed_ms: int | None = None

    async def warmup(self) -> None:
        start_time = time.perf_counter()
        logger.info(
            "Loading image model %s onto %s and running warmup generation.",
            self.default_model_spec.model_id,
            self.config.device,
        )
        async with self._render_lock:
            loop = asyncio.get_running_loop()
            await loop.run_in_executor(self._executor, self._warmup_pipeline)

        self._warmup_elapsed_ms = self._elapsed_ms(start_time)
        self._warmed_up = True
        logger.info("Image model warmup complete in %s ms.", self._warmup_elapsed_ms)

    async def submit(self, prompt: str, *, settings: GenerationSettings) -> GenerationResult:
        self.resolve_model_key(settings.model_key)
        async with self._job_lock:
            self._latest_job_id += 1
            job_id = self._latest_job_id

        start_time = time.perf_counter()

        async with self._render_lock:
            if job_id != self._latest_job_id:
                return GenerationResult(
                    job_id=job_id,
                    stale=True,
                    image_png_base64=None,
                    images_png_base64=None,
                    elapsed_ms=self._elapsed_ms(start_time),
                )

            loop = asyncio.get_running_loop()
            images_png_base64 = await loop.run_in_executor(
                self._executor,
                self._render_png_base64,
                prompt,
                settings,
            )
            stale = job_id != self._latest_job_id
            return GenerationResult(
                job_id=job_id,
                stale=stale,
                image_png_base64=images_png_base64[0] if images_png_base64 else None,
                images_png_base64=None if stale else images_png_base64,
                elapsed_ms=self._elapsed_ms(start_time),
            )

    def close(self) -> None:
        self._close_active_adapter()
        self._executor.shutdown(wait=False, cancel_futures=True)

    def snapshot(self) -> dict[str, Any]:
        loaded = self._active_adapter is not None
        return {
            "loaded": loaded,
            "warmed_up": self._warmed_up,
            "warmup_elapsed_ms": self._warmup_elapsed_ms,
            "latest_job_id": self._latest_job_id,
            "active_model_id": self._active_model_key,
            "model": self.config.public_dict(),
        }

    def _warmup_pipeline(self) -> None:
        adapter = self._get_adapter(self.config.default_model_key)
        adapter.warmup()
        if self.config.device.startswith("cuda") and adapter.torch is not None:
            adapter.torch.cuda.synchronize()

    def _render_png_base64(self, prompt: str, settings: GenerationSettings) -> list[str]:
        adapter = self._get_adapter(settings.model_key)
        generator = adapter.create_generator(settings.seed, settings.batch_size, same_seed=settings.batch_walk)

        if adapter.torch is None:
            raise RuntimeError("Torch did not initialize.")
        with adapter.torch.inference_mode():
            images = adapter.render(prompt, settings, generator=generator)

        results = []
        # if adapter.render returns a single image, wrap it in a list
        if not isinstance(images, list):
            images = [images]

        for image in images:
            buffer = BytesIO()
            image.save(buffer, format="PNG")
            results.append(base64.b64encode(buffer.getvalue()).decode("ascii"))
            
        return results

    @property
    def default_model_spec(self) -> ImageModelSpec:
        return self.config.model_specs[self.config.default_model_key]

    def get_model_spec(self, model_id: str | None) -> ImageModelSpec:
        return self.config.model_specs[self.resolve_model_key(model_id)]

    def resolve_model_key(self, model_id: str | None) -> str:
        key = normalize_model_key(model_id or self.config.default_model_key)
        if key not in self.config.model_specs:
            raise UnsupportedModelError(f"Unsupported image model {model_id!r}.")
        return key

    def _get_adapter(self, model_key: str) -> ImageModelAdapter:
        model_key = self.resolve_model_key(model_key)
        if self._active_adapter is not None and self._active_model_key == model_key:
            return self._active_adapter

        self._close_active_adapter()
        spec = self.config.model_specs[model_key]
        if spec.adapter == "stable-diffusion":
            adapter: ImageModelAdapter = StableDiffusionAdapter(spec, self.config)
        elif spec.adapter == "z-image":
            adapter = ZImageTurboAdapter(spec, self.config)
        elif spec.adapter == "lumina-image":
            adapter = LuminaImageAdapter(spec, self.config)
        else:
            raise UnsupportedModelError(f"No adapter exists for model adapter {spec.adapter!r}.")
        adapter.load()
        self._active_adapter = adapter
        self._active_model_key = model_key
        return adapter

    def _close_active_adapter(self) -> None:
        adapter = self._active_adapter
        if adapter is None:
            return
        torch = adapter.torch
        adapter.close()
        self._active_adapter = None
        self._active_model_key = None
        if torch is not None and self.config.device.startswith("cuda"):
            torch.cuda.empty_cache()

    @staticmethod
    def _elapsed_ms(start_time: float) -> int:
        return int((time.perf_counter() - start_time) * 1000)
