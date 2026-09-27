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

export type FitValue = (typeof FIT_VALUES)[number];
export type BackgroundValue = (typeof BACKGROUND_OPTIONS)[number]["value"];
export type FormatValue = (typeof FORMAT_OPTIONS)[number]["value"];
