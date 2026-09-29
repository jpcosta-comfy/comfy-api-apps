import { readFileSync } from "node:fs";
import path from "node:path";

export type ImageInputSpec = {
  node: string;
  input: string;
  maxSide: number;
  optional?: boolean;
};

export type ParamSpec = {
  node: string;
  input: string;
  builtFrom?: string[];
  map?: Record<string, string | number>;
  default?: string;
  template?: string;
};

export type AppConfig = {
  title: string;
  /** When false, the app stays configured but is omitted from the carousel. */
  enabled?: boolean;
  workflow: string;
  workflowPromptOnly?: string;
  cloudWorkflowId: string;
  cloudWorkflowName: string;
  partnerNodes: boolean;
  imageInputs: Record<string, ImageInputSpec>;
  params: Record<string, ParamSpec>;
  presets?: Record<string, string>;
  intensityWords?: Record<string, string>;
  promptTemplate?: string;
  grids?: Record<string, string>;
  styles?: Record<string, string>;
  motions?: Record<string, string>;
  notes?: string;
  output: { node: string };
};

export type AppsConfig = {
  $comment?: string;
  account: string;
  apps: Record<string, AppConfig>;
};

let cached: AppsConfig | null = null;

export function loadConfig(): AppsConfig {
  if (!cached) {
    const file = path.join(process.cwd(), "workflows", "apps.config.json");
    cached = JSON.parse(readFileSync(file, "utf8")) as AppsConfig;
  }
  return cached;
}

export function listAppIds(): string[] {
  return Object.keys(loadConfig().apps);
}

/** Apps shown in the carousel. `enabled: false` hides an app without removing its wiring. */
export function listVisibleAppIds(): string[] {
  return listAppIds().filter((id) => getApp(id)?.enabled !== false);
}

export function getApp(id: string): AppConfig | null {
  return loadConfig().apps[id] ?? null;
}
