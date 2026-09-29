# Virtual Try On

- API workflow: `workflow_api.json` (Comfy API format, submitted verbatim to this app's deployment `POST /api/v2/jobs`)
- Runtime host: `workflows/deployments.json` → `virtual-try-on` (`COMFY_BASE_URL_VIRTUAL_TRY_ON`)
- Editor copy (not the runtime target): `comfy-api-apps - Virtual Try On` - workflow id `5163ca49-7c0b-4cdb-a2be-a897110b4ac1` - https://cloud.comfy.org/#5163ca49-7c0b-4cdb-a2be-a897110b4ac1

Person photo + garment photo -> person wearing the garment. Uses the **FLUX Virtual Try-On** (BFL) partner node, same as the Comfy template `api_flux_vto`.

| Node | class_type | Role |
|---|---|---|
| 1 | LoadImage | **Person image** |
| 2 | LoadImage | **Garment image** |
| 3 | FluxVTONode | person <- 1, garment <- 2, **prompt** (fit instruction), **seed** |
| 4 | SaveImage | **Output** |

App parameters: `fit` (slim/regular/relaxed) -> node 3 prompt; seed -> node 3.
**Partner node:** requires `extra_data.api_key_comfy_org`; consumes credits.
Test: 768x1024 person + 768x1024 garment, 17.9 s end to end, 768x1024 output.
