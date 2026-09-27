# Comfy API Apps

Five small, production-style web apps that run real ComfyUI workflows on **Comfy Cloud** through the public **Comfy API v2** (`https://cloud.comfy.org/api/v2`). Each app takes any image you upload, not a canned demo asset:

| App | Workflow | Engine |
|---|---|---|
| Product Relight (Studio / Golden / **Neon**) | `workflows/product-relight` | Qwen-Image-Edit-2509 + Relight LoRA (GPU) |
| Image Upscaler (2x / 4x) | `workflows/image-upscaler` | 4x-UltraSharp (GPU) |
| Sprite Generator (image or prompt -> sprite sheet) | `workflows/sprite-generator` | Nano Banana 2 partner node |
| Virtual Try On (person + garment) | `workflows/virtual-try-on` | FLUX VTO partner node |
| Background Removal | `workflows/background-removal` | BiRefNet (GPU) |

## How a run works (server side, key never reaches the browser)
1. Browser uploads the image(s) to our route handler. The server validates type (png/jpg/webp), size, decodes, auto-orients and downsizes to the per-app `maxSide` (see `workflows/apps.config.json`), re-encoding to PNG.
2. `POST /api/v2/assets` (multipart: `file`, `content_type`, `file_path`, `tags` as a **JSON array string** e.g. `["input"]`) -> asset `id`.
3. The server loads `workflow_api.json`, puts `{"__type":"core/ASSET","info":{"id":"<asset id>","file_path":"<name>"}}` into each `LoadImage.inputs.image`, and applies the app params (prompt, seed, scale...).
4. `POST /api/v2/jobs` with `{"workflow": {...}}` and an `Idempotency-Key` header. For apps with partner nodes (sprite, try-on) also send `"extra_data": {"api_key_comfy_org": COMFY_CLOUD_API_KEY}`.
5. Poll `GET /api/v2/jobs/{id}` until `succeeded | failed | canceled | expired`.
6. For each `job.outputs[]` item: `GET /api/v2/assets/{output.id}` -> short-lived signed `url` (~6 h). Proxy/stream the bytes to the browser (don't persist signed URLs). Note: on Cloud today `outputs[].content_type` can be `""` and `size_bytes` `0`; don't rely on them.
Auth everywhere: `Authorization: Bearer $COMFY_CLOUD_API_KEY`.

"View request" in the UI shows the real body sent to `POST /api/v2/jobs` (with the key redacted).

## Env vars
| Name | Required | Notes |
|---|---|---|
| `COMFY_CLOUD_API_KEY` | yes, unless mocking | Comfy platform API key (server only). Today: JP personal. Swap to the work key. |
| `COMFY_CLOUD_BASE_URL` | no | default `https://cloud.comfy.org` |
| `COMFY_MOCK` | no | Set to `1` to skip Comfy Cloud and return sample images so the UI runs end to end without a key. |

Copy `.env.example` to `.env.local`.

## Swap to another Comfy account
1. Create an API key on the account (platform.comfy.org / Cloud settings) with credits.
2. Replace `COMFY_CLOUD_API_KEY` (local `.env.local`, and on Vercel: project `comfy-api-apps` -> Settings -> Environment Variables, Production + Preview) and redeploy.
3. Optional: save the five `workflows/*/workflow_api.json` files on that Comfy Cloud account and update `cloudWorkflowId` in `workflows/apps.config.json`. The app submits the local JSON, so those IDs are only for opening the graph in the editor.
Nothing else is account-specific: all models and nodes used are in the shared Comfy Cloud catalog.

## Local dev
```bash
npm i
npm run dev
```
With `COMFY_MOCK=1` in `.env.local`, uploads return sample outputs (relight tint, lanczos upscale, a sliced sprite sheet, a garment composite, an elliptical cut-out). With a real key and `COMFY_MOCK` unset, the same UI submits the workflows in `workflows/`.

```bash
npm run lint
npm run check
npm run build
```

## Layout
```
workflows/<app>/workflow_api.json   API-format graph submitted verbatim
workflows/<app>/README.md           node map
workflows/apps.config.json          app -> workflow file, node inputs, prompt templates
src/app/api/run/[app]               validate, resize, upload assets, submit job
src/app/api/jobs/[id]               poll job status
src/app/api/outputs/[assetId]       proxy output bytes (fresh signed URL)
src/                                 Next.js App Router UI
```

Sprite prompt-only runs use `workflows/sprite-generator/workflow_api.prompt_only.json` when no image is uploaded. White and lilac backgrounds, and WebP export, for Background Removal are composited in the browser. The cut-out from Comfy is an RGBA PNG.

## Deploy
Vercel project `comfy-api-apps`, git-connected to `jpcosta-comfy/comfy-api-apps` (`main` -> production). Set `COMFY_CLOUD_API_KEY` (and optionally `COMFY_CLOUD_BASE_URL`) in the project environment, then redeploy. Do not set `COMFY_MOCK` in production if you want live Comfy jobs. The browser resizes uploads to 2048 px before POST so they stay under the Vercel request-body limit; the server still checks type, size (15 MB), EXIF orientation, and the per-app `maxSide`.
