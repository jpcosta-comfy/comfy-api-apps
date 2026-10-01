# Paparazzi Me

- API workflow: `workflow_api.json` (Comfy API format, flattened Batch Images subgraph, submitted verbatim to this app's deployment `POST /api/v2/jobs`)
- Runtime host: `workflows/deployments.json` → `paparazzi-me` (`COMFY_BASE_URL_PAPARAZZI_ME`)
- Editor copy (not the runtime target): `comfy-api-apps - Paparazzi Me` - workflow id `205a6275-4330-48db-9177-63746095b7b5` - https://cloud.comfy.org/#205a6275-4330-48db-9177-63746095b7b5
- Template: `api_nano_banana_pro` (Nano Banana Pro), adapted for a face insert

Celebrity / paparazzi scene photo + the user's face -> the user standing in that scene with matching flash and lighting. Uses **Nano Banana Pro** (`GeminiImage2Node`), same partner-node pattern as Hand Product Swap.

| Node | class_type | Role |
|---|---|---|
| 11 | LoadImage | **Scene** — celebrity / paparazzi photo |
| 12 | LoadImage | **User** — face / selfie |
| 36 | BatchImagesNode | Scene + user |
| 35 | GeminiImage2Node | **prompt**, **seed**, **resolution** (`1K` / `2K` / `4K`, default `2K`), model `gemini-3-pro-image-preview` |
| 30 | SaveImage | **Output** |

App parameters: the insert prompt and seed go to node 35. Resolution is optional and also goes to node 35.
**Partner node:** requires `extra_data.api_key_comfy_org`; consumes credits.

The celebrity **name** field in the carousel is a Path A stub. Comfy cannot search the web for a photo. v1 requires the scene upload. A later site-side fetch (with licensing care) can turn a name into the scene image; it is not sent to this workflow.
