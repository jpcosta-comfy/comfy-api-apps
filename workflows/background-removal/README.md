# Background Removal

- API workflow: `workflow_api.json` (Comfy API format, submitted verbatim to this app's deployment `POST /api/v2/jobs`)
- Runtime host: `workflows/deployments.json` → `background-removal` (`COMFY_BASE_URL_BACKGROUND_REMOVAL`)
- Editor copy (not the runtime target): `comfy-api-apps - Background Removal` - workflow id `ced40cbe-93c5-4bc9-8829-2cc5d31cfe6f` - https://cloud.comfy.org/#ced40cbe-93c5-4bc9-8829-2cc5d31cfe6f

Foreground cut-out with BiRefNet (core nodes, same as template `utility_birefnet_remove_background`).

| Node | class_type | Role |
|---|---|---|
| 1 | LoadImage | **Input image** |
| 2 | LoadBackgroundRemovalModel | `birefnet.safetensors` |
| 3 | RemoveBackground | foreground mask |
| 4 | InvertMask | (JoinImageWithAlpha expects the inverted mask) |
| 5 | JoinImageWithAlpha | RGBA image |
| 6 | SaveImage | **Output** (PNG with alpha) |

App parameters: none in the graph. Background choice (transparent / white / lilac) and WebP export are done client-side on a canvas.
GPU only. Test: 768x768 product photo, 7.5 s end to end, 768x768 RGBA output.
