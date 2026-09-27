const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp", "image/jpg"]);
const TARGET_BYTES = 3_600_000;

export type PreparedFile = {
  file: File;
  width: number;
  height: number;
};

function fail(message: string): never {
  throw new Error(message);
}

async function decode(file: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    fail("Could not read that image.");
  }
}

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not read that image."))), type, quality);
  });
}

export async function shrinkForUpload(file: File, maxSide = 2048): Promise<PreparedFile> {
  if (!ALLOWED.has(file.type)) fail("Use a PNG, JPG, or WebP image.");
  if (file.size > 15 * 1024 * 1024) fail("Image must be 15 MB or smaller.");

  const bitmap = await decode(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const smallEnough = scale === 1 && file.size <= TARGET_BYTES && ALLOWED.has(file.type);

  if (smallEnough) {
    bitmap.close();
    return { file, width, height };
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) fail("Could not read that image.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  let quality = 0.92;
  let blob = await canvasBlob(canvas, "image/jpeg", quality);
  while (blob.size > TARGET_BYTES && quality > 0.5) {
    quality -= 0.12;
    blob = await canvasBlob(canvas, "image/jpeg", quality);
  }
  if (blob.size > 4_200_000) {
    fail("That image is still too large after resizing. Try a smaller file.");
  }
  const name = file.name.replace(/\.[^.]+$/, "") || "image";
  return {
    file: new File([blob], `${name}.jpg`, { type: "image/jpeg" }),
    width,
    height,
  };
}

export function randomSeed(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] & 0x7fffffff;
}
