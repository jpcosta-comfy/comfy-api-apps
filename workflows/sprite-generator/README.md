# Sprite Generator

- API workflow: `workflow_api.json` (Comfy API format, submitted verbatim to this app's deployment `POST /api/v2/jobs`)
- Source template: [Single Image to Animated Sprite Sheet](https://www.comfy.org/workflows/template_purz_nb2_single_image_sprite_sheet) (`template_purz_nb2_single_image_sprite_sheet`)
- Runtime host: `workflows/deployments.json` → `sprite-generator` (`COMFY_BASE_URL_SPRITE_GENERATOR`)
- Editor copy (not the runtime target): `comfy-api-apps - Sprite Generator` - workflow id `48e49e4d-2a1d-4338-977d-36347a3b4a4d` - https://cloud.comfy.org/#48e49e4d-2a1d-4338-977d-36347a3b4a4d

One character image → an 8-frame sprite sheet. Uses the template's **Nano Banana 2** node (`GeminiNanoBanana2`): 16:9, 2K, thinking level `HIGH`, and the template system prompt. The prompt asks for a `4 x 2` grid. The browser slices that sheet into the animated preview.

| Node | class_type | Role |
|---|---|---|
| 1 | LoadImage | **Character reference image** (required) |
| 2 | GeminiNanoBanana2 | model `Nano Banana 2 (Gemini 3.1 Flash Image)`, **prompt**, **seed**, aspect_ratio `16:9`, resolution `2K`, thinking_level `HIGH`, response_modalities `IMAGE`, `images` ← node 1 |
| 3 | SaveImage | **Output** (the sheet), prefix `sprite_sheet/spritesheet_output` |

App parameters: `style` (pixel / toon / 3d), `motion` (idle / walk / jump), optional animation text. Frame count is fixed at 8 (4×2), matching the template. The sprite deployment does not include the template's later custom-node packs (WAS crop, essentials math, BiRefNet RMBG, Video Helper Suite), so those per-frame, GIF, and WebM saves are not submitted. The preview plays the 4×2 sheet in the browser.
**Partner node:** the v2 job must include `extra_data.api_key_comfy_org` (the same Comfy API key) and consumes credits.
