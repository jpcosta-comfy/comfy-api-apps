# Open Product Swap

- API workflow: `workflow_api.json` (Comfy API format, submitted to this app's deployment `POST /api/v2/jobs`)
- Runtime host: `workflows/deployments.json` → `open-product-swap` (`COMFY_BASE_URL_OPEN_PRODUCT_SWAP`)
- Deployment: `dep-c6eae195-e598-4f43-8928-00cb4aa3c2d7` · release `f709c8b1-b6a6-49c3-980b-114a03f160ba`
- Auth: `COMFY_API_KEY_WORK_PERSONAL` only. There is no fallback to `COMFY_API_KEY`.
- Editor copy is not published yet (`cloudWorkflowId` is `pending`).

A short clip of someone holding a product, plus a SKU photo, becomes a new clip with that product in the same hands. The clip is trimmed to about 3 seconds. Resolution is a square 480 or 720.

| Node | class_type | Role |
|---|---|---|
| 1 | LoadVideo | **Source clip** (`file` is an asset ref) |
| 2 | Video Slice | First 3 seconds |
| 3 | GetVideoComponents | Frames from the slice |
| 4 | ImageScale | First-frame size. **480p → 480**, **720p → 720**, width and height |
| 6 | LoadImage | **Product** photo |
| 8 | Flux3ImageNode | Still of the new product in the hands. **prompt**, **seed** |
| 18 | CLIPTextEncode | Wan **positive** prompt. Same optional product note |
| 20 | WanVaceToVideo | Width and height follow the resolution control. Length stays 49 |
| 21 | KSampler | **seed** (also written to node 8) |
| 26 | SaveVideo | **Output** mp4 |

The browser sends one video (MP4, MOV, or WebM, 4 MB or less) and one product image. The server uploads the video with `content_type` `video/mp4`, `video/quicktime`, or `video/webm`.

**Partner nodes:** FLUX 3 needs `extra_data.api_key_comfy_org`. That value is `COMFY_API_KEY_WORK_PERSONAL`.
