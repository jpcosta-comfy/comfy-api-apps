# Pumpkin Carve

- API workflow: `workflow_api.json` (one Comfy API graph per job)
- Runtime host: `workflows/deployments.json` → `pumpkin-carve` (`COMFY_BASE_URL_PUMPKIN_CARVE`)
- Deployment: `dep-480af229-63d7-4022-9bdc-2dd20c2ffc9f` · release `87486a19-62f1-40e4-a423-3563387e31d4`
- Auth: `COMFY_API_KEY_TEAM` only. There is no fallback to `COMFY_API_KEY`.
- Editor copy: `bd70e361-ded7-4310-8bb1-b7c4c033f16f` (`comfy-api-apps - Pumpkin Carve`)
- Workspace: Comfy team. GPU rtx-pro-6000-server, region us, min 0 / max 1.

One photo in. A 9:16 Halloween pumpkin-carving timelapse out.

Quiver Arrow2 vectorizes the photo into an SVG and SaveSVG keeps that stencil. The carve edit uses the original image. The SVG is not fed into the edit node.

| Node | class_type | Role |
|---|---|---|
| 10 | LoadImage | **Input** photo |
| 20 | QuiverImageToSVGNodeV2 | Arrow2 vectorize. Live stencil only |
| 21 | SaveSVGNode | Stencil SVG. Not wired into the edit |
| 30 | GeminiImage2Node | Nano Banana Pro carve still, 9:16. Image input is node 10 |
| 31 | SaveImage | Carve still |
| 40 | GrokVideoNode | Grok Imagine Video 1.5 Lite image-to-video timelapse |
| 50 | SaveVideo | **Output** mp4 |

**Partner nodes:** Quiver, Nano Banana Pro, and Grok Imagine Video need `extra_data.api_key_comfy_org`. That value is `COMFY_API_KEY_TEAM`.
