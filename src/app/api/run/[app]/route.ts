import { getApp } from "@/lib/config";
import { uploadAsset, submitJob } from "@/lib/comfy";
import { apiKey, isMockMode } from "@/lib/env";
import { errorResponse, AppError } from "@/lib/http";
import { prepareImage } from "@/lib/images";
import { saveMockJob } from "@/lib/mock";
import { parseRunParams } from "@/lib/params";
import { buildJobBody, filePathFor, redactJobBody, type UploadedAsset } from "@/lib/workflow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request, context: { params: Promise<{ app: string }> }) {
  try {
    const { app: appId } = await context.params;
    const app = getApp(appId);
    if (!app) throw new AppError(404, "not_found", "Unknown app.");

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      throw new AppError(400, "invalid_input", "Upload the image as form data.");
    }

    const files: Record<string, Buffer> = {};
    for (const [role, spec] of Object.entries(app.imageInputs)) {
      const entry = form.get(role);
      if (!(entry instanceof File) || entry.size === 0) {
        if (spec.optional) continue;
        throw new AppError(400, "invalid_input", "Upload the required image.");
      }
      files[role] = await prepareImage(entry, spec.maxSide);
    }

    const params = parseRunParams(app, form, Boolean(files.image));
    const mock = isMockMode();
    const key = apiKey();
    if (!mock && !key) {
      throw new AppError(
        500,
        "missing_key",
        "Set COMFY_CLOUD_API_KEY on the server, or COMFY_MOCK=1 for sample output.",
      );
    }

    const assets: Record<string, UploadedAsset> = {};
    if (mock) {
      for (const role of Object.keys(files)) {
        assets[role] = { id: crypto.randomUUID(), filePath: filePathFor(role) };
      }
    } else {
      for (const [role, png] of Object.entries(files)) {
        const filePath = filePathFor(role);
        const id = await uploadAsset(png, filePath);
        assets[role] = { id, filePath };
      }
    }

    const idempotencyKey = crypto.randomUUID();
    const body = buildJobBody(app, assets, params, key);
    let jobId: string;
    if (mock) {
      const saved = await saveMockJob(app, appId, params, files);
      jobId = saved.id;
    } else {
      jobId = await submitJob(body, idempotencyKey);
    }

    return Response.json({
      jobId,
      idempotencyKey,
      request: redactJobBody(body),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
