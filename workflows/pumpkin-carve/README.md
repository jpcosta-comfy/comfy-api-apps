# Pumpkin Carve

Halloween Comfy API App for Spooky Season Model Jam.

## Pipeline
1. **Input** — user image
2. **Vectorize** — `RecraftVectorizeImageNode` (Quiver rejected celebrity photos via content moderation) + `SaveSVGNode` (stencil for live demo)
3. **Blank Still** — `ByteDanceSeedreamNode` (Seedream 4.5) text-to-image, 1440x2560 (9:16): a big uncarved pumpkin on a night porch (first frame for FLF). Generated without the user photo, so it is always blank.
4. **Carve Still** — `ResizeAndPadImage` pads the user photo to 9:16, `ImageBatch` pairs it with the blank still, and Seedream 4.5 carves the subject into that same pumpkin as a real carving: shaded relief scraped to cream flesh, true cut-through holes with visible rind, knife marks, pumpkin colors only (no sticker, decal or flat fill). Last frame for FLF. No candle or glow.
5. **Timelapse** — `KlingFirstLastFrameNode` (Kling 3.0). First frame is the blank still (node 32), last frame is the carve still (node 30). 720p, 9:16, 8 seconds, audio off. Hyperlapse of real hands and a knife.
6. **Output** — `SaveVideo` (node 50) from node 40 video output index 0

## Note
No reliable SVG→IMAGE node in catalog. Recraft+SaveSVG stay in the graph for the live stencil stage; the image edit uses the **original** input image as reference.

Gemini (IMAGE_PROHIBITED_CONTENT), Quiver, and Seedance 2.0 (OutputVideoSensitiveContentDetected) blocked celebrity photos. Recraft, Seedream 4.5, and Kling 3.0 pass them.

## Partner nodes
`partnerNodes: true` (Recraft, ByteDance Seedream 4.5, Kling 3.0 FLF).
