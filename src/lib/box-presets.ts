import { readFileSync } from "node:fs";
import path from "node:path";
import { AppError } from "@/lib/http";

export type BoxInsert = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type BoxPreset = {
  id: string;
  label: string;
  /** Public URL of the card thumbnail. */
  thumb: string;
  insert: BoxInsert;
  plateSize: [number, number];
};

/**
 * Overhead plates copied from the Open Unboxing preset library.
 * `insert` is a fraction of `plateSize`. The server turns that into pixels.
 */
export const BOX_PRESETS: Record<string, BoxPreset> = {
  kraft_mailer: {
    id: "kraft_mailer",
    label: "Kraft mailer",
    thumb: "/presets/kraft_mailer/thumb.jpg",
    insert: { x: 0.2761, y: 0.5397, w: 0.4693, h: 0.272 },
    plateSize: [880, 1184],
  },
  rigid_luxury: {
    id: "rigid_luxury",
    label: "Rigid luxury",
    thumb: "/presets/rigid_luxury/thumb.jpg",
    insert: { x: 0.3182, y: 0.5304, w: 0.3443, h: 0.2736 },
    plateSize: [880, 1184],
  },
  tissue_wrap: {
    id: "tissue_wrap",
    label: "Tissue wrap",
    thumb: "/presets/tissue_wrap/thumb.jpg",
    insert: { x: 0.3682, y: 0.4248, w: 0.2648, h: 0.2939 },
    plateSize: [880, 1184],
  },
};

export function listBoxPresets(): BoxPreset[] {
  return Object.values(BOX_PRESETS);
}

export function getBoxPreset(id: string): BoxPreset | null {
  return BOX_PRESETS[id] ?? null;
}

export function insertPixels(preset: BoxPreset): { x: number; y: number; width: number; height: number } {
  const [plateW, plateH] = preset.plateSize;
  return {
    x: Math.round(preset.insert.x * plateW),
    y: Math.round(preset.insert.y * plateH),
    width: Math.max(1, Math.round(preset.insert.w * plateW)),
    height: Math.max(1, Math.round(preset.insert.h * plateH)),
  };
}

export function readPresetImage(id: string, kind: "empty" | "lid"): Buffer {
  const preset = getBoxPreset(id);
  if (!preset) throw new AppError(400, "invalid_input", "Choose a box.");
  const filename = kind === "empty" ? "empty.png" : "lid_on.png";
  const file = path.join(process.cwd(), "public", "presets", preset.id, filename);
  try {
    return readFileSync(file);
  } catch {
    throw new AppError(500, "internal", `The ${preset.label} preset image is missing on the server.`);
  }
}
