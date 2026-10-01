import sharp from "sharp";
import { AppError } from "@/lib/http";

const MAX_BYTES = 15 * 1024 * 1024;
const MAX_PIXELS = 40_000_000;

function bad(message: string): never {
  throw new AppError(400, "invalid_input", message);
}

export function sniffImage(buf: Buffer): "png" | "jpeg" | "webp" | null {
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "png";
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "webp";
  }
  return null;
}

export function contentTypeFor(kind: "png" | "jpeg" | "webp" | "bin"): string {
  if (kind === "png") return "image/png";
  if (kind === "jpeg") return "image/jpeg";
  if (kind === "webp") return "image/webp";
  return "application/octet-stream";
}

export async function prepareImageBuffer(buf: Buffer, maxSide: number): Promise<Buffer> {
  if (buf.length <= 0) bad("Upload an image.");
  if (buf.length > MAX_BYTES) bad("Image must be 15 MB or smaller.");
  if (!sniffImage(buf)) bad("That file is not a PNG, JPG, or WebP image.");

  try {
    const oriented = sharp(buf, { limitInputPixels: MAX_PIXELS, failOn: "error" }).rotate();
    const meta = await oriented.metadata();
    if (!meta.width || !meta.height) bad("Could not read that image.");

    let pipeline = sharp(buf, { limitInputPixels: MAX_PIXELS, failOn: "error" }).rotate();
    if (Math.max(meta.width, meta.height) > maxSide) {
      pipeline = pipeline.resize({
        width: meta.width >= meta.height ? maxSide : undefined,
        height: meta.height > meta.width ? maxSide : undefined,
        fit: "inside",
        withoutEnlargement: true,
      });
    }
    return await pipeline.png().toBuffer();
  } catch (error) {
    if (error instanceof AppError) throw error;
    bad("Could not read that image.");
  }
}

export async function prepareImage(file: File, maxSide: number): Promise<Buffer> {
  if (!(file instanceof File) || file.size <= 0) bad("Upload an image.");
  if (file.size > MAX_BYTES) bad("Image must be 15 MB or smaller.");
  const declared = file.type;
  if (declared && !["image/png", "image/jpeg", "image/webp", "image/jpg"].includes(declared)) {
    bad("Use a PNG, JPG, or WebP image.");
  }
  return prepareImageBuffer(Buffer.from(await file.arrayBuffer()), maxSide);
}
