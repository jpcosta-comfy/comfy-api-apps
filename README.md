# Comfy API Apps

Sprite sheets, virtual try-on, hand product swap, paparazzi inserts, and background removal, each running a real ComfyUI workflow on its own personal Comfy API deployment. The API key stays on the server.

Live: [comfy-api-apps.vercel.app](https://comfy-api-apps.vercel.app/)

## Apps

| App | What you do | Engine | Deployment |
|---|---|---|---|
| Sprite sheet generator | Upload a character. Choose style (pixel, toon, 3D), motion (idle, walk, jump), and an optional animation note. | Nano Banana 2. One 4×2 sheet at 16:9 / 2K. The browser slices it into the preview. | [sprite-generator](https://dep-6e5a0ab1-8131-4ee8-acb7-ae1840160e13.run.comfy.app) |
| Virtual try-on | Upload a person and a garment. Choose slim, regular, or relaxed. | FLUX Virtual Try-On | [virtual-try-on](https://dep-d99a045a-86e9-4251-bbae-0a88940f78d1.run.comfy.app) |
| Hand product swap | Upload a hand photo and a product. Same hand and grip, new product. Resolution is 1K, 2K, or 4K. | Nano Banana Pro (Gemini) | [hand-product-swap](https://dep-9a807afc-d80c-43de-adc4-d0eee9a73655.run.comfy.app) |
| Paparazzi Me | Type a celebrity name and upload your face. The server searches for a paparazzi photo (or you pick one). A scene upload is an optional override. Resolution is 1K, 2K, or 4K. | Nano Banana Pro (Gemini) | [paparazzi-me](https://dep-be6a6286-e47c-4e0f-b9fc-8fad55236367.run.comfy.app) |
| Background removal | Upload a photo. Choose transparent, white, or lilac, then PNG or WebP. | BiRefNet. White, lilac, and WebP are composited in the browser. | [background-removal](https://dep-e45cb437-0991-4689-9f7c-77d5748e3adc.run.comfy.app) |

The hosts above are the defaults in `workflows/deployments.json`. Workers are `--min 0 --max 1`, and only 3 deployments can be active at once, so a host may be stopped or still cold-starting.

## How a run works

1. The browser posts the image to `POST /api/run/[app]`. The server accepts png, jpg, or webp up to 15 MB, applies EXIF rotation, and resizes to that app's `maxSide` in `workflows/apps.config.json`. Paparazzi Me can omit the scene file: `GET /api/paparazzi/search?q=` returns signed scene choices, and the run downloads the chosen photo (or the best match for the celebrity name) before upload. A scene file overrides that search. The celebrity name is not sent to the workflow.
2. It uploads the PNG to that app's deployment with `POST /api/v2/assets`. The multipart fields go in this order: `content_type` (`image/png`), `file_path`, `tags` (`["input"]` as a JSON string), then `file`. Putting `file` first returns HTTP 422 `invalid_body`.
3. `workflow_api.json` receives the asset id on each LoadImage, plus the prompt and seed from the controls.
4. `POST /api/v2/jobs` on the same host, with an `Idempotency-Key`. Sprite sheet generator, Virtual try-on, Hand product swap, and Paparazzi Me also send `extra_data.api_key_comfy_org` using the server key. Partner jobs use credits.
5. The browser polls `GET /api/jobs/{app}~{jobId}` for up to 8 minutes. The app slug picks the deployment.
6. Downloads go through `GET /api/outputs/{app}~{assetId}?sig=...`. The signature is checked, then the server loads a short-lived URL (about 6 hours) and streams the bytes.

Every call to a deployment sends `Authorization: Bearer` and the server key.

A stopped deployment (`deployment_stopped`, 422) needs `comfy deploy start` before another run will go through. A cold start (`deployment_not_ready`, 429) means wait, then run again.

## Environment

Server only. Locally that is `.env.local`. On Vercel, project `comfy-api-apps`, Production and Preview.

| Name | Required | Notes |
|---|---|---|
| `COMFY_API_KEY` | yes, unless the alias below is set | Personal Comfy platform key. Preferred name. |
| `COMFY_CLOUD_API_KEY` | alias | Read when `COMFY_API_KEY` is unset. If both are set, `COMFY_API_KEY` wins. This is the key sent for partner nodes. |
| `COMFY_BASE_URL_SPRITE_GENERATOR` | no | Override for that app. Default is in `workflows/deployments.json`. |
| `COMFY_BASE_URL_VIRTUAL_TRY_ON` | no | Same. |
| `COMFY_BASE_URL_HAND_PRODUCT_SWAP` | no | Same. Default host is `https://dep-9a807afc-d80c-43de-adc4-d0eee9a73655.run.comfy.app`. |
| `COMFY_BASE_URL_PAPARAZZI_ME` | no | Same. Default host is `https://dep-be6a6286-e47c-4e0f-b9fc-8fad55236367.run.comfy.app`. |
| `SERPAPI_API_KEY` | no | Paparazzi Me image search. Used when set, ahead of Google CSE and Bing. With no search key, Wikipedia photos are used. |
| `GOOGLE_CSE_API_KEY` | no | Google Programmable Search key. Also set `GOOGLE_CSE_CX`. |
| `GOOGLE_CSE_CX` | no | Google Programmable Search engine id (`searchType=image`). |
| `BING_IMAGE_SEARCH_KEY` | no | Bing Image Search subscription key. Used when the keys above are unset. |
| `COMFY_BASE_URL_BACKGROUND_REMOVAL` | no | Same. |
| `COMFY_MOCK` | no | `1` returns sample images and skips the deployments. Leave unset for live runs. Celebrity search still runs. |
| `OUTPUT_SIGNING_SECRET` | no | HMAC for download links. If unset, SHA-256 of the API key. |

Copy `.env.example` to `.env.local` and paste the key.

## Local

```bash
npm i
npm run dev
```

```bash
npm run lint
npm run check
npm run build
```

## Layout

```
workflows/deployments.json          deployment id, release id, endpoint, env var
workflows/apps.config.json          app → workflow, inputs, prompt templates
workflows/<app>/workflow_api.json   graph submitted to that deployment
workflows/<app>/README.md           node map
src/app/api/run/[app]               validate, resize, upload, submit
src/app/api/jobs/[id]               poll the deployment named in the id
src/app/api/outputs/[assetId]       stream the output after checking sig
src/                                Next.js App Router UI
```

## Deploy

`main` on `jpcosta-comfy/comfy-api-apps` deploys to the Vercel project `comfy-api-apps`.

Set `COMFY_API_KEY` or `COMFY_CLOUD_API_KEY` for Production and Preview, then redeploy. Leave the `COMFY_BASE_URL_*` variables unset unless that environment should call a different host than `workflows/deployments.json`. Leave `COMFY_MOCK` unset for live runs. Set `OUTPUT_SIGNING_SECRET` when download links should stay valid after the API key changes.

The browser resizes uploads to 2048 px before POST so they stay under the Vercel body limit. The server still checks type, the 15 MB cap, EXIF orientation, and each app's `maxSide`.
