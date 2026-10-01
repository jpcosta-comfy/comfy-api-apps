"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { BackgroundValue, FormatValue } from "@/lib/choices";
import { downloadBlob, exportCutout } from "@/lib/composite";
import { randomSeed, shrinkForUpload } from "@/lib/prepare-image";
import { LILAC, TERMINAL_STATUSES, type CatalogApp, type JobView, type RunResponse, type TextControl } from "@/lib/types";
import { AppIcon } from "@/components/app-icon";

type SceneCandidate = {
  token: string;
  title: string;
  source: string;
  width: number;
  height: number;
};

type UploadState = {
  file: File;
  url: string;
  name: string;
  width: number;
  height: number;
};

type HistoryItem = {
  id: string;
  blob: Blob;
  url: string;
  before: Record<string, string>;
  label: string;
  frames: string;
  width: number;
  height: number;
};

type Phase = "idle" | "queued" | "running" | "done" | "error";

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });

function controlValue(values: Record<string, string>, key: string): string {
  return values[key] ?? "";
}

export function AppCard({ app }: { app: CatalogApp }) {
  const defaults = useMemo(() => {
    const next: Record<string, string> = {};
    for (const control of app.controls) next[control.key] = String(control.default);
    return next;
  }, [app.controls]);

  const [values, setValues] = useState<Record<string, string>>(defaults);
  const [uploads, setUploads] = useState<Record<string, UploadState | undefined>>({});
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [need, setNeed] = useState<string | null>(null);
  const [seed, setSeed] = useState<number | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [view, setView] = useState(0);
  const [compare, setCompare] = useState(50);
  const [toast, setToast] = useState<string | null>(null);
  const [hot, setHot] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<SceneCandidate[]>([]);
  const [selectedToken, setSelectedToken] = useState<string | null>(null);
  const [searchProvider, setSearchProvider] = useState("");
  const [searching, setSearching] = useState(false);
  const [findingScene, setFindingScene] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const [previewWidth, setPreviewWidth] = useState(640);

  const active = history.find((item) => item.id === activeId) ?? null;
  const busy = phase === "queued" || phase === "running";

  useEffect(() => {
    const node = previewRef.current;
    if (!node) return;
    const measure = () => setPreviewWidth(node.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [active, view]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 1600);
    return () => clearTimeout(timer);
  }, [toast]);

  function setControl(key: string, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
    if (key === "celebrity") {
      setCandidates([]);
      setSelectedToken(null);
      setSearchProvider("");
      setNeed(null);
    }
  }

  async function findPhotos() {
    if (app.kind !== "paparazzi" || searching || busy) return;
    const name = controlValue(values, "celebrity").trim();
    if (name.length < 2) {
      setNeed("Enter a celebrity name.");
      return;
    }
    setSearching(true);
    setNeed(null);
    setError(null);
    try {
      const response = await fetch(`/api/paparazzi/search?q=${encodeURIComponent(name)}`);
      const payload = (await response.json()) as {
        provider?: string;
        candidates?: SceneCandidate[];
        error?: { message?: string };
      };
      if (!response.ok) {
        setCandidates([]);
        setSelectedToken(null);
        setSearchProvider("");
        setNeed(payload.error?.message || "Image search failed.");
        return;
      }
      const next = payload.candidates ?? [];
      setSearchProvider(payload.provider ?? "");
      setCandidates(next);
      setSelectedToken(next[0]?.token ?? null);
      if (next.length === 0) setNeed("No paparazzi photos found. Try another spelling, or upload a scene photo.");
    } catch {
      setNeed("Image search is unavailable right now. Try again or upload a scene photo.");
    } finally {
      setSearching(false);
    }
  }

  async function takeFile(role: string, file: File | undefined) {
    if (!file) return;
    setNeed(null);
    setError(null);
    try {
      const prepared = await shrinkForUpload(file);
      setUploads((current) => {
        const previous = current[role];
        if (previous) URL.revokeObjectURL(previous.url);
        return {
          ...current,
          [role]: {
            file: prepared.file,
            url: URL.createObjectURL(prepared.file),
            name: file.name,
            width: prepared.width,
            height: prepared.height,
          },
        };
      });
    } catch (err) {
      setNeed(err instanceof Error ? err.message : "Could not read that image.");
    }
  }

  function missingMessage(): string | null {
    if (app.kind === "paparazzi") {
      if (!uploads.user) return "Upload your face.";
      const name = controlValue(values, "celebrity").trim();
      if (!uploads.scene && !selectedToken && name.length < 2) return "Enter a celebrity name or upload a scene photo.";
      return null;
    }
    for (const image of app.images) {
      if (!image.optional && !uploads[image.key]) {
        if (app.kind === "tryon") return "Upload a person and a garment.";
        if (app.kind === "swap") return "Upload a hand photo and a product.";
        if (app.kind === "sprite") return "Upload a character image.";
        return "Upload an image first.";
      }
    }
    return null;
  }

  function labelFor(next = values): string {
    if (app.kind === "relight") {
      const preset = controlValue(next, "preset");
      return `${preset[0]?.toUpperCase()}${preset.slice(1)} · light ${controlValue(next, "direction")} · ${controlValue(next, "intensity")}%`;
    }
    if (app.kind === "upscale") return `${controlValue(next, "scale")}×`;
    if (app.kind === "sprite") {
      const frames = controlValue(next, "frames") || Object.keys(app.grids ?? {})[0] || "8";
      const grid = app.grids?.[frames];
      const gridLabel = grid ? `${grid.cols}×${grid.rows}` : frames;
      const style = controlValue(next, "style");
      return `${frames} frames · ${gridLabel} · ${style === "3d" ? "3D" : style}`;
    }
    if (app.kind === "tryon") return `${controlValue(next, "fit")} fit`;
    if (app.kind === "swap") return controlValue(next, "resolution") || "2K";
    if (app.kind === "paparazzi") {
      const name = controlValue(next, "celebrity").trim();
      const resolution = controlValue(next, "resolution") || "2K";
      return name ? `${resolution} · ${name}` : resolution;
    }
    return `${controlValue(next, "format").toUpperCase()} · ${controlValue(next, "background")}`;
  }

  async function run() {
    const missing = missingMessage();
    if (missing) {
      setNeed(missing);
      return;
    }
    if (busy) return;
    setError(null);
    setNeed(null);
    const nextSeed = app.hasSeed ? randomSeed() : null;
    setSeed(nextSeed);
    setPhase("queued");
    setProgress(0);
    setFindingScene(app.kind === "paparazzi" && !uploads.scene);

    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;

    try {
      const form = new FormData();
      for (const image of app.images) {
        const upload = uploads[image.key];
        if (upload) form.append(image.key, upload.file, upload.file.name);
      }
      for (const control of app.controls) {
        if (control.clientOnly) continue;
        form.append(control.key, controlValue(values, control.key));
      }
      if (app.kind === "sprite" && app.grids && !app.controls.some((control) => control.key === "frames")) {
        form.append("frames", Object.keys(app.grids)[0] ?? "8");
      }
      if (nextSeed !== null) form.append("seed", String(nextSeed));
      if (app.kind === "paparazzi" && !uploads.scene && selectedToken) form.append("sceneToken", selectedToken);

      const response = await fetch(app.endpoint, { method: "POST", body: form, signal: controller.signal });
      setFindingScene(false);
      const payload = (await response.json()) as RunResponse & { error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message || "The run failed.");

      const started = Date.now();
      let failures = 0;
      let job: JobView | null = null;
      while (!job || !TERMINAL_STATUSES.includes(job.status)) {
        if (Date.now() - started > 8 * 60 * 1000) {
          throw new Error("Timed out waiting for this deployment. If it is stopped, start it (3 active max). If it is still cold-starting, wait and run again.");
        }
        await sleep(job ? 1750 : 400, controller.signal);
        const statusRes = await fetch(`/api/jobs/${payload.jobId}`, { signal: controller.signal });
        if (!statusRes.ok) {
          failures += 1;
          if (failures >= 4) {
            const body = (await statusRes.json().catch(() => null)) as { error?: { message?: string } } | null;
            throw new Error(body?.error?.message || "Could not read job status.");
          }
          continue;
        }
        failures = 0;
        job = (await statusRes.json()) as JobView;
        if (job.status === "queued") setPhase("queued");
        if (job.status === "running" || job.status === "canceling") setPhase("running");
        if (typeof job.progress === "number") setProgress(job.progress);
      }

      if (job.status !== "succeeded") {
        throw new Error(job.error?.message || statusMessage(job.status));
      }
      const output = job.outputs[0];
      if (!output?.sig) throw new Error("The job finished without an image.");
      const imageRes = await fetch(`/api/outputs/${encodeURIComponent(output.id)}?sig=${encodeURIComponent(output.sig)}`, { signal: controller.signal });
      if (!imageRes.ok) {
        const body = (await imageRes.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(body?.error?.message || "Could not download the result.");
      }
      const blob = await imageRes.blob();
      const url = URL.createObjectURL(blob);
      const dims = await measureBlob(url);
      const before: Record<string, string> = {};
      for (const image of app.images) {
        const upload = uploads[image.key];
        if (upload) before[image.key] = upload.url;
      }
      const item: HistoryItem = {
        id: payload.jobId,
        blob,
        url,
        before,
        label: labelFor(),
        frames: controlValue(values, "frames") || Object.keys(app.grids ?? {})[0] || "8",
        width: dims.width,
        height: dims.height,
      };
      setHistory((current) => [...current, item].slice(-5));
      setActiveId(item.id);
      setView(0);
      setPhase("done");
      setProgress(1);
    } catch (err) {
      setFindingScene(false);
      if (controller.signal.aborted) return;
      setPhase("error");
      setError(err instanceof Error ? err.message : "The run failed.");
    }
  }

  async function onDownload() {
    if (!active) return;
    try {
      if (app.kind === "cutout") {
        const background = controlValue(values, "background") as BackgroundValue;
        const format = controlValue(values, "format") as FormatValue;
        const blob =
          background === "transparent" && format === "png"
            ? active.blob
            : await exportCutout(active.url, background, format);
        const filename = `${app.id}.${format}`;
        downloadBlob(blob, filename);
        setToast(filename);
        return;
      }
      const ext = active.blob.type.includes("jpeg") ? "jpg" : active.blob.type.includes("webp") ? "webp" : "png";
      const filename = `${app.id}.${ext}`;
      downloadBlob(active.blob, filename);
      setToast(filename);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not download that image.");
    }
  }

  const background = controlValue(values, "background");
  const stageStyle =
    app.kind === "cutout" && active
      ? background === "white"
        ? { background: "#fff" }
        : background === "lilac"
          ? { background: LILAC }
          : undefined
      : undefined;
  const checker = app.kind === "cutout" && active && background === "transparent";
  const primaryKey = app.images[0]?.key;
  const primaryUpload = primaryKey ? uploads[primaryKey] : undefined;
  const beforeUrl = (primaryKey && active?.before[primaryKey]) || "";
  const showCompare = view === 1 && app.views[1] === "Compare" && active && beforeUrl;
  const showSprite = view === 1 && app.kind === "sprite" && active;
  const grid = app.grids?.[active?.frames || Object.keys(app.grids ?? {})[0] || "8"] ?? { cols: 4, rows: 2 };

  const selectedScene = selectedToken ? `/api/paparazzi/scene?token=${encodeURIComponent(selectedToken)}` : "";
  const status = findingScene ? "Searching for a paparazzi photo" : statusLine(phase, progress, error, primaryUpload, active);
  const bar = phase === "idle" ? 0 : phase === "done" ? 1 : phase === "error" ? 0 : progress || (phase === "queued" ? 0.08 : 0.2);
  const pillClass = phase === "running" || phase === "queued" ? "run" : phase === "done" ? "done" : "";
  const pillText = findingScene
    ? "Searching"
    : phase === "queued"
      ? "Queued"
      : phase === "running"
        ? `Running ${Math.round(progress * 100)}%`
        : phase === "done"
          ? "Done"
          : phase === "error"
            ? "Error"
            : "Idle";

  const rmeta = active
    ? app.kind === "upscale"
      ? `${active.width} × ${active.height} · ${active.label}`
      : active.label
    : "";

  return (
    <article className="card">
      <header className="hd">
        <span className={`icon${app.icon === "hanger" ? " hanger" : ""}`} aria-hidden>
          <AppIcon name={app.icon} />
        </span>
        <div className="titles">
          <div className="name">{app.name}</div>
          {app.tagline ? <div className="tagline">{app.tagline}</div> : null}
        </div>
        <span className="chip endpoint" title={`POST ${app.endpoint}`}>
          <span className="m">POST</span>
          <span className="path">{app.endpoint}</span>
        </span>
        <div className={`pill ${pillClass}`} aria-live="polite">
          <i />
          {pillText}
        </div>
      </header>
      <div className="body">
        <div className="panel">
          {app.controls
            .filter((control): control is TextControl => control.type === "text" && control.key === "celebrity")
            .map((control) => (
              <ControlField
                key={control.key}
                control={control}
                value={controlValue(values, control.key)}
                searching={searching}
                onChange={(next) => setControl(control.key, next)}
                onFind={() => void findPhotos()}
              />
            ))}
          {candidates.length > 0 ? (
            <div>
              <div className="lab">
                Scenes
                <b>{searchProvider ? `from ${searchProvider}` : "pick one"}</b>
              </div>
              <div className="scene-pick" role="listbox" aria-label="Paparazzi scenes">
                {candidates.map((candidate) => (
                  <button
                    key={candidate.token}
                    type="button"
                    role="option"
                    aria-selected={candidate.token === selectedToken}
                    className={candidate.token === selectedToken ? "on" : ""}
                    title={candidate.title}
                    onClick={() => setSelectedToken(candidate.token)}
                  >
                    <img src={`/api/paparazzi/scene?token=${encodeURIComponent(candidate.token)}`} alt="" />
                  </button>
                ))}
              </div>
              <p className="field-note">The first scene is used unless you pick another. An uploaded scene overrides this.</p>
            </div>
          ) : null}
          {app.images
            .filter((image) => image.key !== "scene")
            .map((image) => (
              <UploadField
                key={image.key}
                label={image.label}
                optional={image.optional}
                upload={uploads[image.key]}
                hot={hot === image.key}
                onFile={(file) => void takeFile(image.key, file)}
                onHot={(on) => setHot(on ? image.key : null)}
              />
            ))}
          {app.controls
            .filter((control) => control.key !== "celebrity")
            .map((control) => (
            <div key={control.key}>
              <div className="lab">
                {control.label}
                {control.type === "slider" ? <b>{controlValue(values, control.key)}</b> : null}
                {control.type === "text" && control.optional ? <b>optional</b> : null}
              </div>
              {control.type === "seg" ? (
                <div className="seg" role="radiogroup" aria-label={control.label}>
                  {control.options.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={controlValue(values, control.key) === option.value ? "on" : ""}
                      aria-checked={controlValue(values, control.key) === option.value}
                      role="radio"
                      onClick={() => setControl(control.key, option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              ) : null}
              {control.type === "select" ? (
                <select className="select" value={controlValue(values, control.key)} aria-label={control.label} onChange={(event) => setControl(control.key, event.target.value)}>
                  {control.options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : null}
              {control.type === "slider" ? (
                <div className="slider">
                  <input
                    type="range"
                    min={control.min}
                    max={control.max}
                    step={control.step}
                    value={controlValue(values, control.key)}
                    aria-label={control.label}
                    style={{ ["--fill" as string]: `${controlValue(values, control.key)}%` }}
                    onChange={(event) => setControl(control.key, event.target.value)}
                  />
                </div>
              ) : null}
              {control.type === "text" ? (
                <>
                  <textarea
                    className="text"
                    placeholder={control.placeholder}
                    value={controlValue(values, control.key)}
                    aria-label={control.label}
                    maxLength={800}
                    onChange={(event) => setControl(control.key, event.target.value)}
                  />
                  {control.hint ? <p className="field-note">{control.hint}</p> : null}
                </>
              ) : null}
            </div>
          ))}
          {app.images
            .filter((image) => image.key === "scene")
            .map((image) => (
              <UploadField
                key={image.key}
                label={image.label}
                optional={image.optional}
                upload={uploads[image.key]}
                hot={hot === image.key}
                onFile={(file) => void takeFile(image.key, file)}
                onHot={(on) => setHot(on ? image.key : null)}
              />
            ))}
          {app.hasSeed ? (
            <div className="seedline">
              Seed <b>{seed ?? "—"}</b>
            </div>
          ) : null}
          <div className="need" role="status">
            {need}
          </div>
          <button className="run" type="button" onClick={() => void run()} disabled={busy || searching}>
            <span className="label">
              {busy ? (
                findingScene ? "Searching…" : phase === "queued" ? "Queued…" : "Running…"
              ) : active ? (
                "↻ Run again"
              ) : (
                <>
                  {app.runLabel} <span className="arrow" aria-hidden="true">→</span>
                </>
              )}
            </span>
            <span className="bar" style={{ width: `${Math.round(bar * 100)}%` }} />
          </button>
        </div>
        <div className="main">
          <div className="toolbar">
            <div className="seg" role="tablist" aria-label="Result view">
              {app.views.map((name, index) => (
                <button key={name} type="button" role="tab" aria-selected={view === index} className={view === index ? "on" : ""} onClick={() => setView(index)}>
                  {name}
                </button>
              ))}
            </div>
            <span className="rmeta">{rmeta}</span>
            <span className="sp" />
            <button className="btn" type="button" disabled={!active || busy} onClick={() => void run()}>
              ↻ Retry
            </button>
            <button className="btn dark" type="button" disabled={!active} onClick={() => void onDownload()}>
              <span className="arrow" aria-hidden="true">↓</span>
              Download
            </button>
          </div>
          <div className={`preview ${checker ? "checker" : ""}`} ref={previewRef} style={stageStyle}>
            {!active && !app.images.some((image) => uploads[image.key]) && !selectedScene ? (
              <div className="pv-empty">
                <div className="big">✦</div>
                {app.empty}
              </div>
            ) : null}
            {active && !showCompare && !showSprite ? (
              <div className="shot-wrap">
                <img className="shot" src={active.url} alt={`${app.name} result`} />
              </div>
            ) : null}
            {!active && primaryUpload ? (
              <div className="shot-wrap">
                <img className="shot" src={primaryUpload.url} alt="Uploaded image" />
              </div>
            ) : null}
            {!active && !primaryUpload && selectedScene ? (
              <div className="shot-wrap">
                <img className="shot" src={selectedScene} alt="Selected paparazzi scene" />
              </div>
            ) : null}
            {showCompare ? (
              <Compare before={beforeUrl} after={active.url} position={compare} width={previewWidth} onChange={setCompare} />
            ) : null}
            {showSprite && active ? (
              <SpritePlayer
                key={active.url}
                url={active.url}
                frames={Number(active.frames)}
                cols={grid.cols}
                rows={grid.rows}
                sheetWidth={active.width}
                sheetHeight={active.height}
              />
            ) : null}
            {toast ? (
              <div className="toast">
                ✓ Saved <b>{toast}</b>
              </div>
            ) : null}
          </div>
          <div className="foot">
            <div>
              <div className="lab">History</div>
              <div className="slots">
                {Array.from({ length: 5 }, (_, index) => history[index] ?? null).map((item, index) => (
                  <button
                    key={item?.id ?? `empty-${index}`}
                    className={`slot ${item && item.id === activeId ? "on" : ""}`}
                    type="button"
                    disabled={!item}
                    onClick={() => item && setActiveId(item.id)}
                    aria-label={item ? `Result ${index + 1}` : "Empty history slot"}
                  >
                    {item ? <img src={item.url} alt="" /> : null}
                  </button>
                ))}
              </div>
            </div>
            <div className="status">
              <div className="st">
                {status}
              </div>
              <div className="track" aria-hidden>
                <i style={{ width: `${Math.round(bar * 100)}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function statusMessage(status: string): string {
  if (status === "canceled") return "This job was canceled.";
  if (status === "expired") return "This job expired before it finished.";
  return "The job failed.";
}

function statusLine(
  phase: Phase,
  progress: number,
  error: string | null,
  primary: UploadState | undefined,
  active: HistoryItem | null,
): string {
  if (error && phase === "error") return error;
  if (phase === "queued") return "Queued · the deployment may be cold-starting";
  if (phase === "running") return `Running · ${Math.round(progress * 100)}%`;
  if (phase === "done" && active) return `Done · ${active.width} × ${active.height}`;
  if (primary) return `Ready · ${primary.name}`;
  return "Waiting for input";
}

function measureBlob(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve({ width: 0, height: 0 });
    img.src = url;
  });
}

function ControlField({
  control,
  value,
  searching,
  onChange,
  onFind,
}: {
  control: TextControl;
  value: string;
  searching: boolean;
  onChange: (value: string) => void;
  onFind: () => void;
}) {
  return (
    <div>
      <div className="lab">{control.label}</div>
      <div className="find-row">
        <input
          className="text"
          placeholder={control.placeholder}
          value={value}
          aria-label={control.label}
          maxLength={80}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onFind();
            }
          }}
        />
        <button className="btn dark" type="button" onClick={onFind} disabled={searching}>
          {searching ? "Searching…" : "Find photos"}
        </button>
      </div>
      {control.hint ? <p className="field-note">{control.hint}</p> : null}
    </div>
  );
}

function UploadField({
  label,
  optional,
  upload,
  hot,
  onFile,
  onHot,
}: {
  label: string;
  optional?: boolean;
  upload?: UploadState;
  hot: boolean;
  onFile: (file: File | undefined) => void;
  onHot: (on: boolean) => void;
}) {
  return (
    <div>
      <div className="lab">
        {label}
        {optional ? <b>optional</b> : null}
      </div>
      <label
        className={`upload ${hot ? "hot" : ""}`}
        onDragOver={(event) => {
          event.preventDefault();
          onHot(true);
        }}
        onDragLeave={() => onHot(false)}
        onDrop={(event) => {
          event.preventDefault();
          onHot(false);
          onFile(event.dataTransfer.files?.[0]);
        }}
      >
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(event) => {
            onFile(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
        {upload ? (
          <div className="up-done">
            <div className="thumb">
              <img src={upload.url} alt="" />
            </div>
            <div className="up-meta">
              <div className="fn">{upload.name}</div>
              <div className="dim">
                {upload.width} × {upload.height}
              </div>
              <span className="btn">↻ Replace</span>
            </div>
          </div>
        ) : (
          <div className="up-empty">
            <span className="hint">Drop an image or</span>
            <span className="btn dark">
              <span className="arrow" aria-hidden="true">↑</span>
              Upload image
            </span>
          </div>
        )}
      </label>
    </div>
  );
}

function Compare({
  before,
  after,
  position,
  width,
  onChange,
}: {
  before: string;
  after: string;
  position: number;
  width: number;
  onChange: (value: number) => void;
}) {
  function move(clientX: number, box: HTMLDivElement) {
    const rect = box.getBoundingClientRect();
    const next = ((clientX - rect.left) / rect.width) * 100;
    onChange(Math.min(96, Math.max(4, next)));
  }
  return (
    <div
      className="compare"
      onPointerDown={(event) => {
        const box = event.currentTarget;
        box.setPointerCapture(event.pointerId);
        move(event.clientX, box);
      }}
      onPointerMove={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) move(event.clientX, event.currentTarget);
      }}
    >
      <img className="shot" src={after} alt="After" />
      <div className="clip" style={{ width: `${position}%` }}>
        <img className="shot" src={before} alt="Before" style={{ width }} />
      </div>
      <div className="handle" style={{ left: `${position}%` }}>
        <div className="knob">⇆</div>
      </div>
      <span className="tag b">Before</span>
      <span className="tag a">After</span>
    </div>
  );
}

function SpritePlayer({
  url,
  frames,
  cols,
  rows,
  sheetWidth,
  sheetHeight,
}: {
  url: string;
  frames: number;
  cols: number;
  rows: number;
  sheetWidth: number;
  sheetHeight: number;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [measured, setMeasured] = useState<{ width: number; height: number } | null>(null);
  const [box, setBox] = useState<{ width: number; height: number } | null>(null);
  const sheetW = sheetWidth > 0 ? sheetWidth : (measured?.width ?? 0);
  const sheetH = sheetHeight > 0 ? sheetHeight : (measured?.height ?? 0);
  const cellW = sheetW / Math.max(1, cols);
  const cellH = sheetH / Math.max(1, rows);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % Math.max(1, frames));
    }, 111);
    return () => window.clearInterval(timer);
  }, [frames, url]);

  useEffect(() => {
    if (sheetWidth > 0 && sheetHeight > 0) return;
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (!cancelled) setMeasured({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.src = url;
    return () => {
      cancelled = true;
    };
  }, [url, sheetWidth, sheetHeight]);

  useEffect(() => {
    const el = stageRef.current;
    if (!el || cellW <= 0 || cellH <= 0) return;
    const fit = () => {
      const style = getComputedStyle(el);
      const padX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
      const padY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
      const availW = Math.max(1, el.clientWidth - padX);
      const availH = Math.max(1, el.clientHeight - padY);
      const aspect = cellW / cellH;
      let width = availW;
      let height = width / aspect;
      if (height > availH) {
        height = availH;
        width = height * aspect;
      }
      setBox({ width: Math.max(1, Math.round(width)), height: Math.max(1, Math.round(height)) });
    };
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, [cellW, cellH]);

  const col = index % cols;
  const row = Math.floor(index / cols);
  const x = cols <= 1 ? 0 : (col / (cols - 1)) * 100;
  const y = rows <= 1 ? 0 : (row / (rows - 1)) * 100;
  return (
    <div className="sprite-stage" ref={stageRef}>
      {box ? (
        <div
          className="sprite-frame"
          style={{
            width: box.width,
            height: box.height,
            backgroundImage: `url("${url}")`,
            backgroundSize: `${cols * 100}% ${rows * 100}%`,
            backgroundPosition: `${x}% ${y}%`,
          }}
        />
      ) : null}
      <div className="cap">
        frame {index + 1} / {frames} · 9 fps
      </div>
    </div>
  );
}
