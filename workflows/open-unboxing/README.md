# Open Unboxing

- API workflow: `workflow_api.json` (one Comfy API graph per job)
- Runtime host: `workflows/deployments.json` → `open-unboxing` (`COMFY_BASE_URL_OPEN_UNBOXING`)
- Deployment: `dep-727f285f-f3d8-4348-8378-eacd314ebb58` · release id is the placeholder `pending`
- Auth: `COMFY_API_KEY_WORK_PERSONAL` only. There is no fallback to `COMFY_API_KEY`.
- Editor copy is not published yet (`cloudWorkflowId` is `pending`).

One to five product photos and a preset box. The server cuts the product out, nests it in the chosen box, and generates a top-down unboxing from the sealed lid to that nested frame.

Preset stills live in `public/presets/<id>/` (`empty.png`, `lid_on.png`, `thumb.jpg`). The browser only sends the box id. Insert x/y/width/height come from `src/lib/box-presets.ts`.

| Node | class_type | Role |
|---|---|---|
| 1 | LoadImage | **Hero product** photo |
| 2 | LoadBackgroundRemovalModel | `birefnet.safetensors` |
| 3 | RemoveBackground | Foreground mask |
| 4 | InvertMask | Subject mask, same pattern as Background removal |
| 5 | ImageScale | Product RGB scaled to the insert |
| 7 | ImageScale | Mask scaled to the same width and height |
| 9 | LoadImage | Preset **empty** overhead plate (uploaded on the server) |
| 10 | ImageCompositeMasked | Nest the cutout. **x** and **y** come from the preset |
| 11 | Flux3ImageNode | Nested keyframe. Extra angles are `image_3` and up |
| 12 | LoadImage | Preset **lid-on** plate |
| 13 | LtxApi25ImageToVideo | First frame is the lid. Last frame is the FLUX still. Static 90° camera |
| 15 | FrameInterpolationModelLoader | `rife_v4.26.safetensors` |
| 16 | FrameInterpolate | **multiplier 2** |
| 17 | CreateVideo | 48 fps, audio from the LTX clip |
| 18 | SaveVideo | **Output** mp4 |
| 21–24 | LoadImage | Optional extra angles. Removed when that photo was not uploaded |

**Partner nodes:** FLUX 3 and LTX 2.5 need `extra_data.api_key_comfy_org`. That value is `COMFY_API_KEY_WORK_PERSONAL`.
