# Hand Product Swap

- API workflow: `workflow_api.json` (Comfy API format, flattened Batch Images subgraph, submitted verbatim to this app's deployment `POST /api/v2/jobs`)
- Runtime host: `workflows/deployments.json` → `hand-product-swap` (`COMFY_BASE_URL_HAND_PRODUCT_SWAP`)
- Editor copy (not the runtime target): `comfy-api-apps - Hand Product Swap` - workflow id `7f6a1615-e176-48cd-a9de-1d2c0679f171` - https://cloud.comfy.org/#7f6a1615-e176-48cd-a9de-1d2c0679f171

Hand photo + product photo -> the same hand and grip holding the new product. Uses **Nano Banana Pro** (`GeminiImage2Node`), same partner-node pattern as Sprite Generator.

| Node | class_type | Role |
|---|---|---|
| 10 | LoadImage | **Hand / subject** image |
| 11 | LoadImage | **Product** image |
| 12 | GetImageSize | Subject width and height |
| 13 | ResizeAndPadImage | Pad the product to the subject size |
| 19 | BatchImagesNode | Subject + padded product |
| 17 | GeminiImage2Node | **prompt**, **seed**, **resolution** (`1K` / `2K` / `4K`, default `2K`), model `gemini-3-pro-image-preview` |
| 15 | SaveImage | **Output** |

App parameters: the swap prompt and seed go to node 17. Resolution is optional and also goes to node 17.
**Partner node:** requires `extra_data.api_key_comfy_org`; consumes credits.
