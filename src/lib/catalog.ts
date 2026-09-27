import {
  BACKGROUND_OPTIONS,
  DIRECTION_OPTIONS,
  FIT_OPTIONS,
  FORMAT_OPTIONS,
} from "@/lib/choices";
import { getApp, listAppIds, type AppConfig } from "@/lib/config";
import type { CatalogApp, ClientControl, SpriteGrid } from "@/lib/types";

const CHROME: Record<
  string,
  Pick<CatalogApp, "name" | "meta" | "icon" | "runLabel" | "views" | "kind" | "empty"> & {
    images: { key: string; label: string }[];
  }
> = {
  "product-relight": {
    icon: "☀",
    name: "Product relight",
    meta: "packshot → new lighting",
    runLabel: "Relight",
    views: ["Result", "Compare"],
    kind: "relight",
    empty: "Upload an image to get started",
    images: [{ key: "image", label: "Input" }],
  },
  "image-upscaler": {
    icon: "⤢",
    name: "Image upscaler",
    meta: "low-res → sharp",
    runLabel: "Upscale",
    views: ["Result", "Compare"],
    kind: "upscale",
    empty: "Upload an image to get started",
    images: [{ key: "image", label: "Input" }],
  },
  "sprite-generator": {
    icon: "▦",
    name: "Sprite sheet generator",
    meta: "character → animation frames",
    runLabel: "Generate sheet",
    views: ["Sheet", "Preview"],
    kind: "sprite",
    empty: "Upload a character or describe one",
    images: [{ key: "image", label: "Input" }],
  },
  "virtual-try-on": {
    icon: "◧",
    name: "Virtual try-on",
    meta: "person + garment → photo",
    runLabel: "Try it on",
    views: ["Result", "Compare"],
    kind: "tryon",
    empty: "Upload a person and a garment",
    images: [
      { key: "person", label: "Person" },
      { key: "garment", label: "Garment" },
    ],
  },
  "background-removal": {
    icon: "◌",
    name: "Background removal",
    meta: "photo → cut-out",
    runLabel: "Remove background",
    views: ["Result", "Compare"],
    kind: "cutout",
    empty: "Upload an image to get started",
    images: [{ key: "image", label: "Input" }],
  },
};

function labelOf(value: string): string {
  if (value === "3d") return "3D";
  if (value === "2") return "2×";
  if (value === "4") return "4×";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function parseGrid(label: string): SpriteGrid {
  const match = /^(\d+)x(\d+)$/.exec(label);
  if (!match) return { cols: 2, rows: 2 };
  return { cols: Number(match[1]), rows: Number(match[2]) };
}

function controlsFor(id: string, app: AppConfig): ClientControl[] {
  if (id === "product-relight" && app.presets) {
    return [
      {
        type: "seg",
        key: "preset",
        label: "Light preset",
        options: Object.keys(app.presets).map((value) => ({ value, label: labelOf(value) })),
        default: "studio",
      },
      {
        type: "seg",
        key: "direction",
        label: "Direction",
        options: DIRECTION_OPTIONS.map((option) => ({ ...option })),
        default: "right",
      },
      { type: "slider", key: "intensity", label: "Intensity", min: 0, max: 100, step: 1, default: 70 },
    ];
  }
  if (id === "image-upscaler" && app.params.scale?.map) {
    return [
      {
        type: "seg",
        key: "scale",
        label: "Scale",
        options: Object.keys(app.params.scale.map).map((value) => ({ value, label: labelOf(value) })),
        default: "2",
      },
    ];
  }
  if (id === "sprite-generator" && app.styles && app.motions && app.grids) {
    const frames = Object.keys(app.grids).sort((a, b) => Number(a) - Number(b));
    return [
      {
        type: "text",
        key: "description",
        label: "Description",
        placeholder: "Or describe a character…",
        default: "",
      },
      {
        type: "seg",
        key: "style",
        label: "Style",
        options: Object.keys(app.styles).map((value) => ({ value, label: labelOf(value) })),
        default: "3d",
      },
      {
        type: "select",
        key: "motion",
        label: "Motion",
        options: Object.keys(app.motions).map((value) => ({ value, label: labelOf(value) })),
        default: "walk",
      },
      {
        type: "seg",
        key: "frames",
        label: "Frames",
        options: frames.map((value) => ({ value, label: value })),
        default: "4",
      },
    ];
  }
  if (id === "virtual-try-on") {
    return [
      {
        type: "seg",
        key: "fit",
        label: "Fit",
        options: FIT_OPTIONS.map((option) => ({ ...option })),
        default: "regular",
      },
    ];
  }
  if (id === "background-removal") {
    return [
      {
        type: "seg",
        key: "background",
        label: "Background",
        options: BACKGROUND_OPTIONS.map((option) => ({ ...option })),
        default: "transparent",
        clientOnly: true,
      },
      {
        type: "seg",
        key: "format",
        label: "Format",
        options: FORMAT_OPTIONS.map((option) => ({ ...option })),
        default: "png",
        clientOnly: true,
      },
    ];
  }
  return [];
}

export function buildCatalog(): CatalogApp[] {
  return listAppIds().map((id) => {
    const app = getApp(id);
    const chrome = CHROME[id];
    if (!app || !chrome) {
      throw new Error(`Missing UI metadata for ${id}`);
    }
    const images = chrome.images.map((image) => ({
      ...image,
      optional: Boolean(app.imageInputs[image.key]?.optional),
    }));
    const grids = app.grids
      ? Object.fromEntries(Object.entries(app.grids).map(([frames, label]) => [frames, parseGrid(label)]))
      : undefined;
    return {
      id,
      ...chrome,
      images,
      controls: controlsFor(id, app),
      hasSeed: Boolean(app.params.seed),
      endpoint: `/api/run/${id}`,
      grids,
    };
  });
}
