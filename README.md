# Comfy API Apps

Production-style web apps that run real ComfyUI workflows on **personal Comfy API deployments** (`https://<deployment>.run.comfy.app`). Each app calls **its own** deployment with Comfy API v2. The browser never sees the API key, and runs do not go to `https://cloud.comfy.org`.

The carousel shows Sprite Generator, Virtual Try On, and Background Removal. Product Relight and Image Upscaler stay wired (`workflows/apps.config.json` has `"enabled": false`) and are omitted from the nav.

| App | Deployment | Engine |
|---|---|---|
| Product Relight (Studio / Golden / **Neon**) | https://dep-1a2d3e32-57f0-4617-8ee1-a302160f4cb8.run.comfy.app | Qwen-Image-Edit-2509 + Relight LoRA (GPU) |
| Image Upscaler (2x / 4x) | https://dep-226ed4ac-b5eb-4d8d-bb9c-51907d71718a.run.comfy.app | 4x-UltraSharp (GPU) |
| Sprite Generator (image -> 8-frame sprite sheet) | https://dep-6e5a0ab1-8131-4ee8-acb7-ae1840160e13.run.comfy.app | Nano Banana 2 partner node (`template_purz_nb2_single_image_sprite_sheet`) |
| Virtual Try On (person + garment) | https://dep-d99a045a-86e9-4251-bbae-0a88940f78d1.run.comfy.app | FLUX VTO partner node |
| Background Removal | https://dep-e45cb437-0991-4689-9f7c-77d5748e3adc.run.comfy.app | BiRefNet (GPU) |

Checked-in defaults live in `workflows/deployments.json` (deployment id, release id, and the URL above). Workers are `--min 0 --max 1`, and only 3 deployments can be active at once, so a host may be **stopped** or **cold-starting**.

## How a run works (server side, key never reaches the browser)
1. Browser uploads the image(s) to our route handler. The server validates type (png/jpg/webp), size, decodes, auto-orients and downsizes to the per-app `maxSide` (see `workflows/apps.config.json`), re-encoding to PNG.
2. `POST https://<that-app>.run.comfy.app/api/v2/assets` multipart, fields in this order: `content_type` (`image/png`), `file_path`, `tags` as a **JSON array string** (e.g. `["input"]`), then `file`. The deployment returns HTTP 422 `invalid_body` if `file` is sent before `content_type`. The response `id` is the asset id.
3. The server loads `workflow_api.json`, puts `{"__type":"core/ASSET","info":{"id":"<asset id>","file_path":"<name>"}}` into each `LoadImage.inputs.image`, and applies the app params (prompt, seed, scale...).
4. `POST https://<that-app>.run.comfy.app/api/v2/jobs` with `{"workflow": {...}}` and an `Idempotency-Key` header. For apps with partner nodes (sprite, try-on) also send `"extra_data": {"api_key_comfy_org": <the server API key>}`. The JSON returned to the browser as `request` is that body with the key redacted. `deployment.endpointUrl` is the host that received it.
5. The browser polls `GET /api/jobs/{app}~{jobId}` (the slug picks the deployment). That route calls `GET /api/v2/jobs/{id}` on the same host until `succeeded | failed | canceled | expired`.
6. Output ids are `{app}~{assetId}` plus an HMAC `sig`. `GET /api/outputs/{app}~{assetId}?sig=...` checks the signature, then `GET /api/v2/assets/{assetId}` on that deployment -> short-lived signed `url` (~6 h) and streams the bytes. Unsigned or mismatched ids are rejected. A bare asset id with no app slug is rejected, so the route cannot be pointed at a different host.

Auth on every deployment call: `Authorization: Bearer` the server key.

If the deployment answers `deployment_stopped` (422), the app says that deployment is stopped and a retry will not run until it is started. If it answers `deployment_not_ready` (429), the app says it is cold-starting and to wait, then run again. A host that does not respond gets the same kind of message. The browser keeps polling an accepted job for up to 8 minutes.

## Env vars
Set these on the server only (local `.env.local`, and Vercel project `comfy-api-apps` → Settings → Environment Variables, Production and Preview).

| Name | Required on Vercel | Notes |
|---|---|---|
| `COMFY_API_KEY` | yes, unless `COMFY_CLOUD_API_KEY` is already set | Personal Comfy platform API key. Preferred name. Paste the key in Vercel; do not commit it. |
| `COMFY_CLOUD_API_KEY` | alias of the above | Still read when `COMFY_API_KEY` is unset. If both are set, `COMFY_API_KEY` wins. Same key is sent as `extra_data.api_key_comfy_org` for Sprite Generator and Virtual Try On. |
| `COMFY_BASE_URL_PRODUCT_RELIGHT` | no | Override for Product Relight. Default in `workflows/deployments.json`. |
| `COMFY_BASE_URL_IMAGE_UPSCALER` | no | Override for Image Upscaler. |
| `COMFY_BASE_URL_SPRITE_GENERATOR` | no | Override for Sprite Generator. |
| `COMFY_BASE_URL_BACKGROUND_REMOVAL` | no | Override for Background Removal. |
| `COMFY_BASE_URL_VIRTUAL_TRY_ON` | no | Override for Virtual Try On. |
| `COMFY_MOCK` | no | Set to `1` to skip deployments and return sample images. Do not set this in production if you want live runs. |
| `OUTPUT_SIGNING_SECRET` | no | HMAC key for output download links. If unset, SHA-256 of the resolved API key (or of an empty string in mock mode). |

`COMFY_CLOUD_BASE_URL` is **not** used. There is no shared Cloud host.

Copy `.env.example` to `.env.local`. The only value you need to paste for the personal endpoints is the API key.

## Local dev
```bash
npm i
npm run dev
```
With `COMFY_MOCK=1` in `.env.local`, uploads return sample outputs (relight tint, lanczos upscale, a sliced sprite sheet, a garment composite, an elliptical cut-out). With a real key and `COMFY_MOCK` unset, each app submits to its deployment in `workflows/deployments.json`.

```bash
npm run lint
npm run check
npm run build
```

## Layout
```
workflows/deployments.json          per-app deployment id, release id, endpoint URL, env var name
workflows/<app>/workflow_api.json   API-format graph submitted to that deployment
workflows/<app>/README.md           node map
workflows/apps.config.json          app -> workflow file, node inputs, prompt templates
src/app/api/run/[app]               validate, resize, upload assets, submit job
src/app/api/jobs/[id]               poll job status on the deployment encoded in the id
src/app/api/outputs/[assetId]       proxy output bytes after checking the HMAC `sig`
src/                                 Next.js App Router UI
```

Sprite Generator requires a character image and always asks Nano Banana 2 for a 4×2 sheet at 16:9 / 2K. White and lilac backgrounds, and WebP export, for Background Removal are composited in the browser. The cut-out from the deployment is an RGBA PNG.

## Deploy
Vercel project `comfy-api-apps`, git-connected to `jpcosta-comfy/comfy-api-apps` (`main` -> production).

On Vercel, set `COMFY_API_KEY` or `COMFY_CLOUD_API_KEY` (Production + Preview), then redeploy. Leave the `COMFY_BASE_URL_*` variables unset unless a Preview or Production environment should call a different deployment than `workflows/deployments.json`. Do not set `COMFY_MOCK` in production if you want live runs. Set `OUTPUT_SIGNING_SECRET` if download links should stay valid when the API key rotates.

The browser resizes uploads to 2048 px before POST so they stay under the Vercel request-body limit; the server still checks type, size (15 MB), EXIF orientation, and the per-app `maxSide`.

Deployments ship with minimum instances at 0. Start one with `comfy deploy start` before expecting a live image (at most 3 active). Crayon is not part of this app.
