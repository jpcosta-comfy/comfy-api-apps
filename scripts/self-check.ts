import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { getApp, type AppConfig } from "../src/lib/config";
import { prepareImage } from "../src/lib/images";
import { saveMockJob, renderMockOutput } from "../src/lib/mock";
import { buildPrompt, intensityWord } from "../src/lib/prompts";
import { buildJobBody, redactJobBody } from "../src/lib/workflow";

process.chdir(path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."));

function mustApp(id: string): AppConfig {
  const app = getApp(id);
  if (!app) throw new Error(`Missing app ${id}`);
  return app;
}

const relight = mustApp("product-relight");
const upscale = mustApp("image-upscaler");
const sprite = mustApp("sprite-generator");
const tryon = mustApp("virtual-try-on");
const cutout = mustApp("background-removal");

const words = relight.intensityWords!;
assert.equal(intensityWord(0, words), "subtle");
assert.equal(intensityWord(33, words), "subtle");
assert.equal(intensityWord(34, words), "balanced");
assert.equal(intensityWord(66, words), "balanced");
assert.equal(intensityWord(67, words), "strong, dramatic");
assert.equal(intensityWord(100, words), "strong, dramatic");

const neon = buildPrompt(relight, { preset: "neon", direction: "right", intensity: 90, hasImage: true });
assert.ok(neon.startsWith("重新照明,"));
assert.ok(neon.includes("strong, dramatic"));
assert.ok(neon.includes("from the right"));
assert.ok(neon.includes("magenta"));
assert.equal(neon.includes("{direction}"), false);
assert.equal(neon.includes("{intensity}"), false);
assert.equal(neon.includes("{preset}"), false);

const relightBody = buildJobBody(
  relight,
  { image: { id: "11111111-1111-4111-8111-111111111111", filePath: "input.png" } },
  { preset: "neon", direction: "right", intensity: 90, seed: 424242, hasImage: true },
  null,
);
assert.equal(relightBody.extra_data, undefined);
assert.equal(relightBody.workflow["10"].inputs.prompt, neon);
assert.equal(relightBody.workflow["13"].inputs.seed, 424242);
assert.deepEqual(relightBody.workflow["1"].inputs.image, {
  __type: "core/ASSET",
  info: { id: "11111111-1111-4111-8111-111111111111", file_path: "input.png" },
});
assert.equal(relightBody.workflow["1"].class_type, "LoadImage");
assert.equal(relightBody.workflow["15"].class_type, "SaveImage");

const up4 = buildJobBody(upscale, { image: { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", filePath: "input.png" } }, { scale: "4", hasImage: true }, null);
assert.equal(up4.workflow["4"].inputs.scale_by, 1);
assert.equal(up4.workflow["2"].inputs.model_name, "4x-UltraSharp.pth");
assert.equal(up4.extra_data, undefined);
const up2 = buildJobBody(upscale, { image: { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", filePath: "input.png" } }, { scale: "2", hasImage: true }, null);
assert.equal(up2.workflow["4"].inputs.scale_by, 0.5);

const secret = "super-secret-key";
const promptOnly = buildJobBody(
  sprite,
  {},
  { style: "pixel", motion: "jump", frames: "12", description: "a small friendly robot", seed: 7, hasImage: false },
  secret,
);
assert.equal(promptOnly.workflow["1"], undefined);
assert.equal(promptOnly.workflow["2"].class_type, "GeminiImage2Node");
assert.equal(promptOnly.workflow["2"].inputs.aspect_ratio, "21:9");
assert.equal(promptOnly.workflow["2"].inputs.seed, 7);
const spritePrompt = String(promptOnly.workflow["2"].inputs.prompt);
assert.ok(spritePrompt.includes("a small friendly robot"));
assert.ok(spritePrompt.includes("12-frame"));
assert.ok(spritePrompt.includes("6x2"));
assert.ok(spritePrompt.includes("pixel-art"));
assert.equal(promptOnly.extra_data?.api_key_comfy_org, secret);
const redacted = JSON.stringify(redactJobBody(promptOnly));
assert.equal(redacted.includes(secret), false);
assert.ok(redacted.includes("<redacted>"));

const withImage = buildJobBody(
  sprite,
  { image: { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", filePath: "input.png" } },
  { style: "3d", motion: "walk", frames: "4", description: "", seed: 3, hasImage: true },
  secret,
);
assert.equal(withImage.workflow["1"].class_type, "LoadImage");
assert.ok(String(withImage.workflow["2"].inputs.prompt).includes("the character in the reference image"));
assert.equal(withImage.workflow["2"].inputs.aspect_ratio, "1:1");
assert.deepEqual(withImage.workflow["2"].inputs.images, ["1", 0]);

const vto = buildJobBody(
  tryon,
  {
    person: { id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", filePath: "person.png" },
    garment: { id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", filePath: "garment.png" },
  },
  { fit: "slim", seed: 9, hasImage: false },
  secret,
);
assert.equal(vto.workflow["3"].inputs.prompt, "Replace the outfit with the reference garment, slim fit");
assert.equal(vto.workflow["3"].class_type, "FluxVTONode");
assert.equal(vto.workflow["3"].inputs.seed, 9);
assert.equal((vto.workflow["1"].inputs.image as { info: { file_path: string } }).info.file_path, "person.png");
assert.equal((vto.workflow["2"].inputs.image as { info: { file_path: string } }).info.file_path, "garment.png");
assert.ok(vto.extra_data);

const bg = buildJobBody(
  cutout,
  { image: { id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", filePath: "input.png" } },
  { hasImage: true },
  secret,
);
assert.equal(bg.extra_data, undefined);
assert.equal(bg.workflow["2"].inputs.bg_removal_name, "birefnet.safetensors");
assert.equal(bg.workflow["6"].class_type, "SaveImage");

assert.throws(() => buildPrompt(relight, { preset: "nope", direction: "left", intensity: 10 }), /preset/i);

async function main() {
const wide = await sharp({
  create: { width: 3000, height: 1000, channels: 3, background: { r: 20, g: 40, b: 200 } },
}).png().toBuffer();
const prepared = await prepareImage(new File([new Uint8Array(wide)], "wide.png", { type: "image/png" }), 1024);
const preparedMeta = await sharp(prepared).metadata();
assert.equal(preparedMeta.width, 1024);
assert.ok((preparedMeta.height ?? 0) <= 1024);
assert.equal(preparedMeta.format, "png");

const turned = await sharp({
  create: { width: 80, height: 20, channels: 3, background: { r: 200, g: 20, b: 20 } },
})
  .jpeg()
  .withMetadata({ orientation: 6 })
  .toBuffer();
const oriented = await prepareImage(new File([new Uint8Array(turned)], "turn.jpg", { type: "image/jpeg" }), 1536);
const orientedMeta = await sharp(oriented).metadata();
assert.ok((orientedMeta.height ?? 0) > (orientedMeta.width ?? 0));

await assert.rejects(
  () => prepareImage(new File([Buffer.from("hello")], "nope.png", { type: "image/png" }), 512),
  /PNG, JPG, or WebP/,
);

const sample = await sharp({
  create: { width: 64, height: 48, channels: 3, background: { r: 180, g: 190, b: 200 } },
}).png().toBuffer();
const garment = await sharp({
  create: { width: 40, height: 30, channels: 3, background: { r: 240, g: 180, b: 20 } },
}).png().toBuffer();

const studio = await saveMockJob(relight, "product-relight", { preset: "studio", direction: "left", intensity: 20 }, { image: sample });
const neonJob = await saveMockJob(relight, "product-relight", { preset: "neon", direction: "right", intensity: 100 }, { image: sample });
const studioPng = await renderMockOutput(studio.outputId, undefined);
const neonPng = await renderMockOutput(neonJob.outputId, undefined);
assert.ok(studioPng[0] === 0x89);
assert.notDeepEqual(studioPng, neonPng);

const upJob = await saveMockJob(upscale, "image-upscaler", { scale: "2" }, { image: sample });
const upPng = await renderMockOutput(upJob.outputId, undefined);
const upMeta = await sharp(upPng).metadata();
assert.equal(upMeta.width, 128);
assert.equal(upMeta.height, 96);

const sheet = await saveMockJob(
  sprite,
  "sprite-generator",
  { style: "3d", motion: "walk", frames: "4", description: "robot" },
  {},
);
const sheetPng = await renderMockOutput(sheet.outputId, sprite.grids);
const sheetMeta = await sharp(sheetPng).metadata();
assert.equal(sheetMeta.width, 1024);
assert.equal(sheetMeta.height, 1024);

const vtoJob = await saveMockJob(tryon, "virtual-try-on", { fit: "regular" }, { person: sample, garment });
const vtoPng = await renderMockOutput(vtoJob.outputId, undefined);
assert.ok(vtoPng.byteLength > 100);

const cutJob = await saveMockJob(cutout, "background-removal", {}, { image: sample });
const cutPng = await renderMockOutput(cutJob.outputId, undefined);
const cutMeta = await sharp(cutPng).metadata();
assert.equal(cutMeta.hasAlpha, true);

console.log("self-check ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
