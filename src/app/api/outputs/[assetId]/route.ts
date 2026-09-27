import { getApp } from "@/lib/config";
import { fetchAssetUrl } from "@/lib/comfy";
import { isMockMode } from "@/lib/env";
import { errorResponse, AppError } from "@/lib/http";
import { isMockOutputId, isUuid } from "@/lib/ids";
import { contentTypeFor, sniffImage } from "@/lib/images";
import { renderMockOutput } from "@/lib/mock";
import { verifyAssetSignature } from "@/lib/signing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_OUTPUT = 40 * 1024 * 1024;

function attachment(name: string, type: string, bytes: Uint8Array): Response {
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": type,
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": "private, no-store",
      "Content-Disposition": `inline; filename="${name.replace(/[^a-zA-Z0-9._-]/g, "") || "output.png"}"`,
    },
  });
}

export async function GET(request: Request, context: { params: Promise<{ assetId: string }> }) {
  try {
    const { assetId } = await context.params;
    if (assetId.includes("/") || assetId.includes("\\") || assetId.includes("..")) {
      throw new AppError(404, "not_found", "Output not found.");
    }

    const signature = new URL(request.url).searchParams.get("sig");
    if (!verifyAssetSignature(assetId, signature)) {
      throw new AppError(404, "not_found", "Output not found.");
    }

    if (isMockOutputId(assetId)) {
      if (!isMockMode()) throw new AppError(404, "not_found", "Output not found.");
      const grids = getApp("sprite-generator")?.grids;
      const png = await renderMockOutput(assetId, grids);
      return attachment("output.png", "image/png", png);
    }

    if (!isUuid(assetId)) throw new AppError(404, "not_found", "Output not found.");

    const signed = await fetchAssetUrl(assetId);
    let upstream: Response;
    try {
      upstream = await fetch(signed, { redirect: "follow", signal: AbortSignal.timeout(60_000) });
    } catch {
      throw new AppError(502, "upstream_error", "Could not download the output image.");
    }
    if (!upstream.ok || !upstream.url.startsWith("https://")) {
      throw new AppError(502, "upstream_error", "Could not download the output image.");
    }
    const bytes = new Uint8Array(await upstream.arrayBuffer());
    if (bytes.byteLength === 0) throw new AppError(502, "upstream_error", "Comfy Cloud returned an empty output.");
    if (bytes.byteLength > MAX_OUTPUT) throw new AppError(502, "upstream_error", "Output image is too large to proxy.");

    const kind = sniffImage(Buffer.from(bytes)) ?? "bin";
    const type = contentTypeFor(kind);
    const ext = kind === "jpeg" ? "jpg" : kind === "bin" ? "bin" : kind;
    return attachment(`output.${ext}`, type, bytes);
  } catch (error) {
    return errorResponse(error);
  }
}
