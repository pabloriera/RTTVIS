import torch
from diffusers import AutoPipelineForText2Image
pipe = AutoPipelineForText2Image.from_pretrained("/models/image/sd-turbo", torch_dtype=torch.float16, variant="fp16")
pipe.to("cuda")

prompt_embeds, negative_prompt_embeds = pipe.encode_prompt("a cat", "cuda", 2, False)
print(prompt_embeds.shape)
