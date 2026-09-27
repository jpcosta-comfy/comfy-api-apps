import { comfyBaseUrl, apiKey } from "@/lib/env";
import { AppError } from "@/lib/http";
import type { JobBody } from "@/lib/workflow";
import type { JobStatus, JobView } from "@/lib/types";

const STATUSES = new Set<JobStatus>([
  "queued",
  "running",
  "succeeded",
  "canceling",
  "canceled",
  "failed",
  "expired",
]);

type ErrorEnvelope = {
  error?: { code?: string; message?: string };
};

type AssetRecord = {
  id?: string;
  url?: string;
};

type RawOutput = {
  id?: string;
  node_id?: string;
  name?: string;
};

type RawJob = {
  id?: string;
  status?: string;
  progress?: { value?: number } | null;
  outputs?: RawOutput[];
  error?: { code?: string; message?: string } | null;
};

async function comfyFetch(pathname: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const key = apiKey();
  if (!key) {
    throw new AppError(
      500,
      "missing_key",
      "Set COMFY_CLOUD_API_KEY on the server, or COMFY_MOCK=1 for sample output.",
    );
  }
  try {
    return await fetch(`${comfyBaseUrl()}${pathname}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${key}`,
        ...(init.headers ?? {}),
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new AppError(504, "timeout", "Comfy Cloud timed out. Try again.");
    }
    throw new AppError(502, "upstream_error", "Could not reach Comfy Cloud.");
  }
}

async function throwEnvelope(res: Response): Promise<never> {
  let code = "upstream_error";
  let message = `Comfy Cloud returned ${res.status}.`;
  try {
    const body = (await res.json()) as ErrorEnvelope;
    if (body.error?.code) code = body.error.code;
    if (body.error?.message) message = body.error.message;
  } catch {
    /* non-JSON body */
  }
  const status = res.status >= 400 && res.status < 600 ? res.status : 502;
  throw new AppError(status, code, message);
}

export async function uploadAsset(png: Buffer, filePath: string): Promise<string> {
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(png)], { type: "image/png" }), filePath);
  form.append("content_type", "image/png");
  form.append("file_path", filePath);
  form.append("tags", JSON.stringify(["input"]));

  const res = await comfyFetch("/api/v2/assets", { method: "POST", body: form }, 60_000);
  if (!res.ok) await throwEnvelope(res);
  const asset = (await res.json()) as AssetRecord;
  if (!asset.id) throw new AppError(502, "upstream_error", "Comfy Cloud did not return an asset id.");
  return asset.id;
}

export async function submitJob(body: JobBody, idempotencyKey: string): Promise<string> {
  const res = await comfyFetch(
    "/api/v2/jobs",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(body),
    },
    45_000,
  );
  if (!res.ok) await throwEnvelope(res);
  const job = (await res.json()) as RawJob;
  if (!job.id) throw new AppError(502, "upstream_error", "Comfy Cloud did not return a job id.");
  return job.id;
}

export function mapJob(job: RawJob): JobView {
  const status = STATUSES.has(job.status as JobStatus) ? (job.status as JobStatus) : "failed";
  const outputs = (job.outputs ?? [])
    .filter((item) => typeof item.id === "string" && item.id.length > 0)
    .map((item) => ({
      id: item.id as string,
      nodeId: typeof item.node_id === "string" ? item.node_id : "",
      name: typeof item.name === "string" ? item.name : "",
    }));
  const value = job.progress?.value;
  const progress = typeof value === "number" && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : null;
  const error =
    job.error && typeof job.error.message === "string"
      ? { code: job.error.code || "failed", message: job.error.message }
      : null;
  return {
    id: job.id || "",
    status,
    progress,
    outputs,
    error,
  };
}

export async function fetchJob(id: string): Promise<JobView> {
  const res = await comfyFetch(`/api/v2/jobs/${encodeURIComponent(id)}`, { method: "GET" }, 20_000);
  if (!res.ok) await throwEnvelope(res);
  return mapJob((await res.json()) as RawJob);
}

export async function fetchAssetUrl(id: string): Promise<string> {
  const res = await comfyFetch(`/api/v2/assets/${encodeURIComponent(id)}`, { method: "GET" }, 20_000);
  if (!res.ok) await throwEnvelope(res);
  const asset = (await res.json()) as AssetRecord;
  if (!asset.url || !asset.url.startsWith("https://")) {
    throw new AppError(502, "upstream_error", "Comfy Cloud did not return a signed output URL.");
  }
  return asset.url;
}
