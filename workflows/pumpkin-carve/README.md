# Pumpkin Carve

Halloween Comfy API App for Spooky Season Model Jam.

## Pipeline
1. **Input** — user image
2. **Vectorize** — `QuiverImageToSVGNodeV2` (arrow-2) + `SaveSVGNode` (stencil for live demo)
3. **Carve Still** — `GeminiImage2Node` (Nano Banana Pro) 9:16 pumpkin. The reference design is carved as clean silhouette cuts. Openings are dark voids. Night porch ambient light only. No candle, flame, fire, smoke, or internal glow.
4. **Blank Still** — `GeminiImage2Node` uncarves the same framing (first frame for FLF). No fire or glow.
5. **Timelapse** — `ByteDance2FirstLastFrameNode`, model `Seedance 2.0`. First frame is the blank still (node 32), last frame is the carve still (node 30). 720p, 9:16, 8 seconds, audio off. Hyperlapse of real hands and a knife cutting the silhouette. Locked camera. No candle, flame, fire, torch, internal glow, or CGI look.
6. **Output** — `SaveVideo` (node 50) from node 40 video output index 0

## Note
No reliable SVG→IMAGE node in catalog. Quiver+SaveSVG stay in the graph for the live stencil stage; the image edit uses the **original** input image as reference.

1080p on Seedance 2.0 costs about 2.5× the 720p clip for the same 8 seconds, so the live graph stays at 720p.

## Partner nodes
`partnerNodes: true` (Quiver, Gemini, ByteDance Seedance 2.0 FLF).
