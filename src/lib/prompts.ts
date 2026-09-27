import type { AppConfig } from "@/lib/config";
import { FIT_VALUES, type FitValue } from "@/lib/choices";
import { AppError } from "@/lib/http";

export type RunParams = {
  preset?: string;
  direction?: "left" | "right";
  intensity?: number;
  scale?: string;
  style?: string;
  motion?: string;
  frames?: string;
  description?: string;
  fit?: string;
  seed?: number;
  hasImage?: boolean;
};

function bad(message: string): never {
  throw new AppError(400, "invalid_input", message);
}

export function intensityWord(intensity: number, words: Record<string, string>): string {
  for (const [range, word] of Object.entries(words)) {
    const [start, end] = range.split("-").map((part) => Number(part));
    if (Number.isFinite(start) && Number.isFinite(end) && intensity >= start && intensity <= end) {
      return word;
    }
  }
  return bad("Intensity is out of range.");
}

export function buildPrompt(app: AppConfig, params: RunParams): string {
  if (app.presets && app.promptTemplate && app.intensityWords) {
    const presetKey = params.preset ?? "";
    const presetText = app.presets[presetKey];
    if (!presetText) bad("Choose a light preset.");
    if (params.direction !== "left" && params.direction !== "right") bad("Choose a light direction.");
    const intensity = params.intensity ?? 0;
    const word = intensityWord(intensity, app.intensityWords);
    const preset = presetText.replaceAll("{direction}", params.direction);
    return app.promptTemplate.replaceAll("{intensity}", word).replaceAll("{preset}", preset);
  }

  if (app.styles && app.motions && app.grids && app.promptTemplate) {
    const style = app.styles[params.style ?? ""];
    const motion = app.motions[params.motion ?? ""];
    const frames = params.frames ?? "";
    const grid = app.grids[frames];
    if (!style) bad("Choose a style.");
    if (!motion) bad("Choose a motion.");
    if (!grid) bad("Choose a frame count.");
    const description = (params.description ?? "").trim();
    const subject = params.hasImage
      ? description
        ? `the character in the reference image, ${description}`
        : "the character in the reference image"
      : description;
    if (!subject) bad("Upload a character image or describe one.");
    return app.promptTemplate
      .replaceAll("{subject}", subject)
      .replaceAll("{frames}", frames)
      .replaceAll("{motion}", motion)
      .replaceAll("{grid}", grid)
      .replaceAll("{style}", style);
  }

  const template = app.params.prompt?.template;
  if (template) {
    const fit = (params.fit ?? "").toLowerCase();
    if (!FIT_VALUES.includes(fit as FitValue)) bad("Choose a fit.");
    return template.replaceAll("{fit}", fit);
  }

  return bad("This app has no prompt.");
}
