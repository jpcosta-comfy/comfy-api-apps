/** App-facing words substituted into workflow prompts. Not node ids. */

export const FIT_VALUES = ["slim", "regular", "relaxed"] as const;

export const FIT_OPTIONS = [
  { value: "slim", label: "Slim" },
  { value: "regular", label: "Regular" },
  { value: "relaxed", label: "Relaxed" },
] as const;

export const BACKGROUND_OPTIONS = [
  { value: "transparent", label: "Transparent" },
  { value: "white", label: "White" },
  { value: "lilac", label: "Lilac" },
] as const;

export const FORMAT_OPTIONS = [
  { value: "png", label: "PNG" },
  { value: "webp", label: "WebP" },
] as const;

export const DIRECTION_OPTIONS = [
  { value: "left", label: "Left" },
  { value: "right", label: "Right" },
] as const;

export const RESOLUTION_VALUES = ["1K", "2K", "4K"] as const;

export const RESOLUTION_OPTIONS = [
  { value: "1K", label: "1K" },
  { value: "2K", label: "2K" },
  { value: "4K", label: "4K" },
] as const;

export type ResolutionValue = (typeof RESOLUTION_VALUES)[number];

export type FitValue = (typeof FIT_VALUES)[number];
export type BackgroundValue = (typeof BACKGROUND_OPTIONS)[number]["value"];
export type FormatValue = (typeof FORMAT_OPTIONS)[number]["value"];
