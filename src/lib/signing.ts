import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { JobView } from "@/lib/types";

function signingKey(): string {
  const explicit = process.env.OUTPUT_SIGNING_SECRET?.trim();
  if (explicit) return explicit;
  const apiKey = process.env.COMFY_CLOUD_API_KEY?.trim() ?? "";
  return createHash("sha256").update(apiKey).digest("hex");
}

export function signAssetId(assetId: string): string {
  return createHmac("sha256", signingKey()).update(assetId).digest("hex");
}

export function verifyAssetSignature(assetId: string, signature: string | null): boolean {
  const expected = Buffer.from(signAssetId(assetId), "hex");
  const given = signature && /^[0-9a-f]{64}$/i.test(signature) ? Buffer.from(signature, "hex") : null;
  if (!given || given.length !== expected.length) {
    timingSafeEqual(expected, expected);
    return false;
  }
  return timingSafeEqual(expected, given);
}

export function signJobView(job: JobView): JobView {
  return {
    ...job,
    outputs: job.outputs.map((output) => ({ ...output, sig: signAssetId(output.id) })),
  };
}
