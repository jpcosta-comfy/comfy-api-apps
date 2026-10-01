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

The celebrity **name** is search input for the site, not a workflow field. `GET /api/paparazzi/search` returns paparazzi photo candidates. The run downloads the selected photo, or the best match when the user does not pick one, and uploads it as node 11. The selfie is still node 12. A scene file skips search. Comfy does not search the web.

With no search key, the server uses DuckDuckGo image results. Set `SERPAPI_API_KEY`, or both `GOOGLE_CSE_API_KEY` and `GOOGLE_CSE_CX`, or `BING_IMAGE_SEARCH_KEY` to use that provider instead (SerpAPI, then Google, then Bing).
