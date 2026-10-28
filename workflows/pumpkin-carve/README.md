# Pumpkin Carve

Halloween Comfy API App for Spooky Season Model Jam.

## Pipeline
1. **Input** — user image
2. **Vectorize** — `QuiverImageToSVGNodeV2` (arrow-2) + `SaveSVGNode` (stencil for live demo)
3. **Carve Still** — `GeminiImage2Node` (Nano Banana Pro) 9:16 pumpkin with design carved + glow
4. **Blank Still** — `GeminiImage2Node` uncarves the same framing (first frame for FLF)
5. **Timelapse** — `ByteDanceFirstLastFrameNode` Seedance 1.5 Pro FLF (blank → carved) → vertical video
6. **Output** — `SaveVideo`

## Note
No reliable SVG→IMAGE node in catalog. Quiver+SaveSVG stay in the graph for the live stencil stage; the image edit uses the **original** input image as reference.

## Partner nodes
`partnerNodes: true` (Quiver, Gemini, ByteDance Seedance FLF).
