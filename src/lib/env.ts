import { loadConfig } from "@/lib/config";

export function isMockMode(): boolean {
  const value = process.env.COMFY_MOCK;
  return value === "1" || value === "true";
}

export function hasApiKey(): boolean {
  return Boolean(process.env.COMFY_CLOUD_API_KEY);
}

export function apiKey(): string | null {
  const key = process.env.COMFY_CLOUD_API_KEY;
  return key && key.trim() ? key.trim() : null;
}

export function comfyBaseUrl(): string {
  const fromEnv = process.env.COMFY_CLOUD_BASE_URL?.trim();
  const raw = fromEnv || loadConfig().baseUrl || "https://cloud.comfy.org";
  return raw.replace(/\/+$/, "");
}
