# Product Relight

- API workflow: `workflow_api.json` (Comfy API format, submitted verbatim to `POST /api/v2/jobs`)
- Saved on Comfy Cloud (JP personal, for testing): `comfy-api-apps - Product Relight` - workflow id `b4f6d5c2-597a-46b5-924d-bd54f4b1f212` - https://cloud.comfy.org/#b4f6d5c2-597a-46b5-924d-bd54f4b1f212

Relights a product photo with a text lighting instruction. Built from the Comfy template `image_qwen_image_edit_2509_relight` with the subgraph flattened into plain API format.

| Node | class_type | Role |
|---|---|---|
| 1 | LoadImage | **Input image** (`inputs.image`, replaced with a `core/ASSET` reference by the server) |
| 2 | FluxKontextImageScale | Resizes to a Qwen/Kontext-friendly resolution (~1MP) |
| 3 | UNETLoader | `qwen_image_edit_2509_fp8_e4m3fn.safetensors` |
| 4 | CLIPLoader | `qwen_2.5_vl_7b_fp8_scaled.safetensors`, type `qwen_image` |
| 5 | VAELoader | `qwen_image_vae.safetensors` |
| 6 | LoraLoaderModelOnly | `Qwen-Image-Edit-2509-Lightning-4steps-V1.0-bf16.safetensors` (4-step) |
| 7 | LoraLoaderModelOnly | `Qwen-Image-Edit-2509-Relight.safetensors` |
| 8 | ModelSamplingAuraFlow | shift 3 |
| 9 | CFGNorm | strength 1 |
| 10 | TextEncodeQwenImageEditPlus | **Prompt** (`inputs.prompt`). Must start with the LoRA trigger `重新照明,` |
| 11 | TextEncodeQwenImageEditPlus | Negative (empty) |
| 12 | VAEEncode | Latent from the input image |
| 13 | KSampler | **seed**, 4 steps, cfg 1, euler/simple |
| 14 | VAEDecode | |
| 15 | SaveImage | **Output** |

App parameters: `preset` (studio / golden / **neon**), `direction` (left/right), `intensity` (0-100) -> built into the node 10 prompt (see `apps.config.json`). Seed -> node 13.
GPU only (no partner nodes). Test: 768x768 product photo, neon preset, 14.1 s end to end, 1024x1024 output.
