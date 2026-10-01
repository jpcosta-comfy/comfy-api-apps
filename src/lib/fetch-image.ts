import { AppError } from "@/lib/http";
import { sniffImage } from "@/lib/images";

const MAX_BYTES = 15 * 1024 * 1024;
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function blockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    return true;
  }
  if (/^\d+$/.test(host)) return true;
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (v4) {
    const parts = v4.slice(1).map(Number);
    if (parts.some((part) => part > 255)) return true;
    const [a, b] = parts;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a >= 224) return true;
    return false;
  }
  if (host.includes(":")) {
    return host === "::" || host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80") || host.startsWith("ff");
  }
  return false;
}

/** HTTPS image URL that is not a local, private, or link-local address. */
export function assertPublicImageUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new AppError(400, "invalid_input", "That photo address is not allowed.");
  }
  if (url.protocol !== "https:" || url.username || url.password || blockedHost(url.hostname)) {
    throw new AppError(400, "invalid_input", "That photo address is not allowed.");
  }
  return url;
}

async function readCapped(res: Response): Promise<Buffer> {
  const reader = res.body?.getReader();
  if (!reader) throw new AppError(502, "scene_download_failed", "Could not download that photo.");
  const chunks: Buffer[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel();
      throw new AppError(400, "invalid_input", "That photo is larger than 15 MB. Pick another.");
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}

export async function downloadPublicImage(raw: string): Promise<Buffer> {
  let current = assertPublicImageUrl(raw).toString();
  for (let hop = 0; hop < 4; hop += 1) {
    let res: Response;
    try {
      res = await fetch(current, {
        redirect: "manual",
        headers: { Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8", "User-Agent": BROWSER_UA },
        signal: AbortSignal.timeout(12_000),
        cache: "no-store",
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (error instanceof Error && error.name === "TimeoutError") {
        throw new AppError(504, "scene_download_failed", "That photo took too long to download. Pick another.");
      }
      throw new AppError(502, "scene_download_failed", "Could not download that photo.");
    }
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) throw new AppError(502, "scene_download_failed", "Could not download that photo.");
      current = assertPublicImageUrl(new URL(location, current).toString()).toString();
      continue;
    }
    if (!res.ok) throw new AppError(502, "scene_download_failed", "Could not download that photo.");
    const buf = await readCapped(res);
    if (!sniffImage(buf)) throw new AppError(502, "scene_download_failed", "That photo was not a PNG, JPG, or WebP image.");
    return buf;
  }
  throw new AppError(502, "scene_download_failed", "Could not download that photo.");
}
