export function isMockMode(): boolean {
  const value = process.env.COMFY_MOCK;
  return value === "1" || value === "true";
}

/** Prefer COMFY_API_KEY. COMFY_CLOUD_API_KEY still works when the new name is unset. */
export function apiKey(): string | null {
  const preferred = process.env.COMFY_API_KEY?.trim();
  if (preferred) return preferred;
  const legacy = process.env.COMFY_CLOUD_API_KEY?.trim();
  return legacy || null;
}

export function hasApiKey(): boolean {
  return Boolean(apiKey());
}

export function missingKeyMessage(): string {
  return "Set COMFY_API_KEY or COMFY_CLOUD_API_KEY on the server, or COMFY_MOCK=1 for sample output.";
}
