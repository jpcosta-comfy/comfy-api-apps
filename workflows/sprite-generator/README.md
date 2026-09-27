# Sprite Generator

- API workflow: `workflow_api.json` (Comfy API format, submitted verbatim to `POST /api/v2/jobs`)
- Saved on Comfy Cloud (JP personal, for testing): `comfy-api-apps - Sprite Generator` - workflow id `48e49e4d-2a1d-4338-977d-36347a3b4a4d` - https://cloud.comfy.org/#48e49e4d-2a1d-4338-977d-36347a3b4a4d

Character image (or prompt only) -> sprite sheet grid. Uses the **Nano Banana 2** partner node.

| Node | class_type | Role |
|---|---|---|
| 1 | LoadImage | **Character reference image** (omitted in `workflow_api.prompt_only.json`) |
| 2 | GeminiImage2Node | model `Nano Banana 2 (Gemini 3.1 Flash Image)`, **prompt**, **seed**, **aspect_ratio**, resolution `1K`, response_modalities `IMAGE`, `images` <- node 1 |
| 3 | SaveImage | **Output** (the sheet) |

App parameters: `style` (3d/toon/pixel), `motion` (idle/walk/jump), `frames` (4 -> 2x2 @1:1, 8 -> 4x2 @16:9, 12 -> 6x2 @21:9), optional text `description` -> built into the node 2 prompt. The client slices the sheet into frames for the animated preview.
**Partner node:** the v2 job must include `extra_data.api_key_comfy_org` (the same Comfy API key) and consumes credits.
Test: 768x768 character, 4-frame walk, 17.5 s end to end, 1024x1024 2x2 sheet.
