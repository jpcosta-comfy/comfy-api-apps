import { readFileSync } from "node:fs";
import path from "node:path";
import type { AppConfig, ParamSpec } from "@/lib/config";
import { AppError } from "@/lib/http";
import { buildPrompt, type RunParams } from "@/lib/prompts";

export type WorkflowNode = {
  class_type: string;
  inputs: Record<string, unknown>;
  _meta?: { title?: string };
};

export type Workflow = Record<string, WorkflowNode>;

export type AssetRef = {
  __type: "core/ASSET";
  info: { id: string; file_path: string };
};

export type JobBody = {
  workflow: Workflow;
  extra_data?: { api_key_comfy_org: string };
};

export type UploadedAsset = {
  id: string;
  filePath: string;
};

const FILE_NAMES: Record<string, string> = {
  image: "input.png",
  person: "person.png",
  garment: "garment.png",
};

export function filePathFor(role: string): string {
  return FILE_NAMES[role] ?? `${role.replace(/[^a-z0-9_-]/gi, "") || "input"}.png`;
}

export function assetRef(id: string, filePath: string): AssetRef {
  return { __type: "core/ASSET", info: { id, file_path: filePath } };
}

function loadWorkflow(rel: string): Workflow {
  const prefix = "workflows/";
  if (!rel.startsWith(prefix) || rel.includes("..") || path.isAbsolute(rel)) {
    throw new AppError(500, "internal", "Workflow path is outside the workflows directory.");
  }
  // Join under workflows/ so the file tracer can see the directory. A fully
  // dynamic path.resolve(cwd, rel) either drops these JSON files or pulls in
  // the whole project.
  const resolved = path.join(process.cwd(), "workflows", rel.slice(prefix.length));
  return JSON.parse(readFileSync(resolved, "utf8")) as Workflow;
}

function mappedValue(spec: ParamSpec, params: RunParams): string | number {
  const map = spec.map ?? {};
  if (params.scale !== undefined && String(params.scale) in map && spec.input === "scale_by") {
    return map[String(params.scale)];
  }
  if (params.frames !== undefined && String(params.frames) in map) {
    return map[String(params.frames)];
  }
  throw new AppError(400, "invalid_input", `Missing a value for ${spec.input}.`);
}

export function applyParams(workflow: Workflow, app: AppConfig, params: RunParams): void {
  for (const [name, spec] of Object.entries(app.params)) {
    const node = workflow[spec.node];
    if (!node) {
      throw new AppError(500, "internal", `Workflow is missing node ${spec.node}.`);
    }
    if (name === "prompt") {
      node.inputs[spec.input] = buildPrompt(app, params);
    } else if (name === "seed") {
      node.inputs[spec.input] = params.seed ?? 0;
    } else if (spec.map) {
      node.inputs[spec.input] = mappedValue(spec, params);
    } else if (spec.default !== undefined) {
      node.inputs[spec.input] = spec.default;
    }
  }
}

export function buildJobBody(
  app: AppConfig,
  assets: Record<string, UploadedAsset>,
  params: RunParams,
  keyForPartner: string | null,
): JobBody {
  const promptOnly = Boolean(app.workflowPromptOnly && !assets.image);
  const workflow = loadWorkflow(promptOnly ? app.workflowPromptOnly! : app.workflow);

  for (const [role, spec] of Object.entries(app.imageInputs)) {
    const asset = assets[role];
    if (!asset) {
      if (spec.optional || promptOnly) continue;
      throw new AppError(400, "invalid_input", "Upload the required image.");
    }
    const node = workflow[spec.node];
    if (!node) throw new AppError(500, "internal", `Workflow is missing node ${spec.node}.`);
    node.inputs[spec.input] = assetRef(asset.id, asset.filePath);
  }

  applyParams(workflow, app, params);

  const body: JobBody = { workflow };
  if (app.partnerNodes) {
    body.extra_data = { api_key_comfy_org: keyForPartner ?? "" };
  }
  return body;
}

export function redactJobBody(body: JobBody): JobBody {
  const clone = structuredClone(body);
  if (clone.extra_data && "api_key_comfy_org" in clone.extra_data) {
    clone.extra_data.api_key_comfy_org = "<redacted>";
  }
  return clone;
}
