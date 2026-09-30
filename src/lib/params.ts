import { randomInt } from "node:crypto";
import { FIT_VALUES, type FitValue } from "@/lib/choices";
import type { AppConfig } from "@/lib/config";
import { AppError } from "@/lib/http";
import type { RunParams } from "@/lib/prompts";

function text(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function bad(message: string): never {
  throw new AppError(400, "invalid_input", message);
}

export function parseSeed(raw: string): number {
  if (!raw) return randomInt(0, 2 ** 31);
  if (!/^\d+$/.test(raw)) bad("Seed must be an integer from 0 to 2^31 − 1.");
  const seed = Number(raw);
  if (!Number.isSafeInteger(seed) || seed < 0 || seed >= 2 ** 31) {
    bad("Seed must be an integer from 0 to 2^31 − 1.");
  }
  return seed;
}

export function parseRunParams(app: AppConfig, form: FormData, hasImage: boolean): RunParams {
  const params: RunParams = { hasImage };

  if (app.presets) {
    const preset = text(form, "preset");
    if (!app.presets[preset]) bad("Choose a light preset.");
    params.preset = preset;
    const direction = text(form, "direction");
    if (direction !== "left" && direction !== "right") bad("Choose a light direction.");
    params.direction = direction;
    const intensity = Number(text(form, "intensity"));
    if (!Number.isFinite(intensity)) bad("Set an intensity from 0 to 100.");
    params.intensity = Math.min(100, Math.max(0, Math.round(intensity)));
  }

  if (app.styles && app.motions && app.grids) {
    const style = text(form, "style");
    const motion = text(form, "motion");
    const gridKeys = Object.keys(app.grids);
    let frames = text(form, "frames");
    if (!frames && gridKeys.length === 1) frames = gridKeys[0];
    if (!app.styles[style]) bad("Choose a style.");
    if (!app.motions[motion]) bad("Choose a motion.");
    if (!app.grids[frames]) bad("Choose a frame count.");
    const description = text(form, "description");
    if (description.length > 800) bad("Description must be 800 characters or less.");
    if (!hasImage) bad("Upload a character image.");
    params.style = style;
    params.motion = motion;
    params.frames = frames;
    params.description = description;
  }

  if (app.params.scale) {
    const scale = text(form, "scale");
    const map = app.params.scale.map ?? {};
    if (!(scale in map)) bad("Choose a scale of 2× or 4×.");
    params.scale = scale;
  }

  if (app.params.prompt?.template) {
    const fit = text(form, "fit").toLowerCase();
    if (!FIT_VALUES.includes(fit as FitValue)) bad("Choose a fit.");
    params.fit = fit;
  }

  if (app.params.seed) {
    params.seed = parseSeed(text(form, "seed"));
  }

  return params;
}
