# Image Upscaler

- API workflow: `workflow_api.json` (Comfy API format, submitted verbatim to `POST /api/v2/jobs`)
- Saved on Comfy Cloud (JP personal, for testing): `comfy-api-apps - Image Upscaler` - workflow id `fb6f5a18-d7cf-496d-8c61-6b20fb80ac96` - https://cloud.comfy.org/#fb6f5a18-d7cf-496d-8c61-6b20fb80ac96

Model-based super-resolution.

| Node | class_type | Role |
|---|---|---|
| 1 | LoadImage | **Input image** |
| 2 | UpscaleModelLoader | `4x-UltraSharp.pth` (alternatives on Cloud: `RealESRGAN_x4plus.pth`, `4x-ClearRealityV1.pth`, `RealESRGAN_x2plus.pth`) |
| 3 | ImageUpscaleWithModel | 4x upscale |
| 4 | ImageScaleBy | **scale_by**: 0.5 => 2x overall, 1.0 => 4x overall (lanczos) |
| 5 | SaveImage | **Output** |

App parameters: `scale` 2 or 4 -> node 4 `scale_by`. The server caps input at 1024 px on the long side so 4x output stays <= 4096 px.
GPU only. Test: 256x256 input, 4x, 7.5 s end to end, 1024x1024 output.
