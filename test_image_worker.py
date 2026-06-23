from types import SimpleNamespace

import torch

from app.image_worker import (
    GenerationSettings,
    ImageGenerationConfig,
    ImageModelSpec,
    PromptConditioner,
    StableDiffusionAdapter,
    ZImageTurboAdapter,
)


def _config() -> tuple[ImageModelSpec, ImageGenerationConfig]:
    spec = ImageModelSpec(
        key="test",
        label="Test",
        model_id="test/model",
        model_dir="/missing",
        adapter="test",
        width=64,
        height=64,
        num_inference_steps=1,
        guidance_scale=0,
    )
    return spec, ImageGenerationConfig(
        default_model_key="test",
        model_specs={"test": spec},
        device="cpu",
        dtype="float32",
        width=64,
        height=64,
        num_inference_steps=1,
        guidance_scale=0,
        prompt_conditioning_mode="prompt",
        token=None,
    )


def _settings(
    *,
    batch_size: int = 3,
    batch_walk: bool = True,
    batch_walk_scale: float = 0.01,
) -> GenerationSettings:
    return GenerationSettings(
        model_key="test",
        width=64,
        height=64,
        num_inference_steps=1,
        guidance_scale=0,
        seed=1,
        batch_size=batch_size,
        batch_walk=batch_walk,
        batch_walk_scale=batch_walk_scale,
    )


def test_perturbed_batch_changes_every_tensor_item_independently() -> None:
    conditioner = PromptConditioner("embeds", "cpu")
    embeds = torch.ones((3, 2, 4))
    perturbation_scale = 0.15

    result = conditioner.transform_prompt_embeds(
        embeds,
        batch_walk=True,
        batch_walk_scale=perturbation_scale,
    )

    assert result.shape == embeds.shape
    perturbation_norms = torch.linalg.vector_norm(result - embeds, dim=(1, 2))
    embedding_norms = torch.linalg.vector_norm(embeds, dim=(1, 2))
    assert torch.allclose(
        perturbation_norms / embedding_norms,
        torch.full((3,), perturbation_scale),
    )
    assert not torch.equal(result[0] - embeds[0], result[1] - embeds[1])
    assert torch.equal(
        result,
        conditioner.transform_prompt_embeds(
            embeds,
            batch_walk=True,
            batch_walk_scale=perturbation_scale,
        ),
    )


def test_perturbed_batch_supports_list_embeddings() -> None:
    conditioner = PromptConditioner("embeds", "cpu")
    embeds = [torch.ones((2, 4)), torch.ones((3, 4))]

    result = conditioner.transform_prompt_embeds(embeds, batch_walk=True)

    assert [item.shape for item in result] == [item.shape for item in embeds]
    assert all(not torch.equal(item, original) for item, original in zip(result, embeds))


def test_perturbed_batch_uses_selected_scale() -> None:
    conditioner = PromptConditioner("embeds", "cpu")
    embeds = torch.ones((3, 2, 4))

    small = conditioner.transform_prompt_embeds(
        embeds,
        batch_walk=True,
        batch_walk_scale=0.01,
    )
    large = conditioner.transform_prompt_embeds(
        embeds,
        batch_walk=True,
        batch_walk_scale=0.02,
    )

    assert torch.allclose(large - embeds, 2 * (small - embeds), atol=1e-6)


class _StablePipeline:
    def __init__(self) -> None:
        self.call_kwargs = None

    def encode_prompt(self, _prompt, *, num_images_per_prompt, **_kwargs):
        embeds = torch.ones((num_images_per_prompt, 2, 4))
        return embeds, None

    def __call__(self, **kwargs):
        self.call_kwargs = kwargs
        return SimpleNamespace(images=[object()] * kwargs["prompt_embeds"].shape[0])


def test_stable_pipeline_does_not_expand_prebatched_embeddings_twice() -> None:
    spec, config = _config()
    adapter = StableDiffusionAdapter(spec, config)
    adapter.pipeline = _StablePipeline()

    images = adapter.render("test", _settings(), generator=None)

    assert len(images) == 3
    assert adapter.pipeline.call_kwargs["num_images_per_prompt"] == 1
    assert adapter.pipeline.call_kwargs["prompt_embeds"].shape[0] == 3


class _ZImagePipeline:
    def __init__(self) -> None:
        self.encoded_prompt = None
        self.call_kwargs = None

    def encode_prompt(self, prompt, **_kwargs):
        self.encoded_prompt = prompt
        return [torch.ones((2, 4)) for _ in prompt], None

    def __call__(self, **kwargs):
        self.call_kwargs = kwargs
        return SimpleNamespace(images=[object()] * len(kwargs["prompt_embeds"]))


def test_z_image_perturbed_batch_uses_one_embedding_per_output() -> None:
    spec, config = _config()
    adapter = ZImageTurboAdapter(spec, config)
    adapter.pipeline = _ZImagePipeline()

    images = adapter.render("test", _settings(), generator=None)

    assert len(images) == 3
    assert adapter.pipeline.encoded_prompt == ["test"] * 3
    assert adapter.pipeline.call_kwargs["prompt"] is None
    assert adapter.pipeline.call_kwargs["num_images_per_prompt"] == 1
    assert all(
        not torch.equal(embed, torch.ones_like(embed))
        for embed in adapter.pipeline.call_kwargs["prompt_embeds"]
    )
