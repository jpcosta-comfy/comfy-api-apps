export type JobStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "canceling"
  | "canceled"
  | "failed"
  | "expired";

export type JobOutput = {
  id: string;
  nodeId: string;
  name: string;
};

export type JobView = {
  id: string;
  status: JobStatus;
  progress: number | null;
  outputs: JobOutput[];
  error: { code: string; message: string } | null;
};

export type RunResponse = {
  jobId: string;
  idempotencyKey: string;
  request: unknown;
};

export type SegControl = {
  type: "seg";
  key: string;
  label: string;
  options: { value: string; label: string }[];
  default: string;
  clientOnly?: boolean;
};

export type SelectControl = {
  type: "select";
  key: string;
  label: string;
  options: { value: string; label: string }[];
  default: string;
  clientOnly?: boolean;
};

export type SliderControl = {
  type: "slider";
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  default: number;
  clientOnly?: boolean;
};

export type TextControl = {
  type: "text";
  key: string;
  label: string;
  placeholder: string;
  default: string;
  clientOnly?: boolean;
};

export type ClientControl = SegControl | SelectControl | SliderControl | TextControl;

export type CatalogImage = {
  key: string;
  label: string;
  optional?: boolean;
};

export type SpriteGrid = {
  cols: number;
  rows: number;
};

export type CatalogApp = {
  id: string;
  name: string;
  meta: string;
  icon: string;
  runLabel: string;
  endpoint: string;
  views: [string, string];
  kind: "relight" | "upscale" | "sprite" | "tryon" | "cutout";
  images: CatalogImage[];
  controls: ClientControl[];
  hasSeed: boolean;
  empty: string;
  grids?: Record<string, SpriteGrid>;
};

export const LILAC = "#DBD6F2";

export const TERMINAL_STATUSES: JobStatus[] = ["succeeded", "canceled", "failed", "expired"];
