import { getApp } from "@/lib/config";
import { uploadAsset, submitJob } from "@/lib/comfy";
import { deploymentTarget } from "@/lib/deployments";
import { apiKey, isMockMode, missingKeyMessage } from "@/lib/env";
import { errorResponse, AppError } from "@/lib/http";
import { publicRouteId } from "@/lib/ids";
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
      throw new AppError(500, "missing_key", missingKeyMessage());
    }
    const target = mock ? null : deploymentTarget(appId);

    const assets: Record<string, UploadedAsset> = {};
    if (mock || !target) {
      for (const role of Object.keys(files)) {
        assets[role] = { id: crypto.randomUUID(), filePath: filePathFor(role) };
      }
    } else {
      for (const [role, png] of Object.entries(files)) {
        const filePath = filePathFor(role);
        const id = await uploadAsset(target, png, filePath);
        assets[role] = { id, filePath };
      }
    }

    const idempotencyKey = crypto.randomUUID();
    const body = buildJobBody(app, assets, params, key);
    let jobId: string;
    if (mock || !target) {
      const saved = await saveMockJob(app, appId, params, files);
      jobId = saved.id;
    } else {
      jobId = publicRouteId(appId, await submitJob(target, body, idempotencyKey));
    }

    return Response.json({
      jobId,
      idempotencyKey,
      request: redactJobBody(body),
      deployment: target
        ? { slug: target.slug, endpointUrl: target.baseUrl, deploymentId: target.deploymentId }
        : undefined,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
