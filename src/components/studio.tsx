"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AppCard } from "@/components/app-card";
import type { CatalogApp } from "@/lib/types";

/** Storyboard NAV_S. The slide lasts just under a second. */
const NAV_S = 0.99;
/**
 * Approximates ease.slide: velocity peaks near SLIDE_P (0.365), then eases
 * out to a stop. Both control points stay inside the unit box, so the curve
 * never overshoots.
 */
const SLIDE_EASE = "cubic-bezier(0.61, 0.92, 0.21, 1)";
const DESKTOP_PEEK = 48;
const DESKTOP_GAP = 16;

export function Studio({
  apps,
  mock,
  configured,
}: {
  apps: CatalogApp[];
  mock: boolean;
  configured: boolean;
}) {
  const count = apps.length;
  const viewportRef = useRef<HTMLDivElement>(null);
  const stageRefs = useRef<Array<HTMLDivElement | null>>([]);
  const indexRef = useRef(0);
  const posRef = useRef(0);
  const busyRef = useRef(false);
  const [index, setIndex] = useState(0);
  const [trackPos, setTrackPos] = useState(0);
  const [anchor, setAnchor] = useState(0);
  const [motion, setMotion] = useState(false);
  const [busy, setBusy] = useState(false);
  const [metrics, setMetrics] = useState({ width: 0, peek: 0, gap: 0 });

  const current = apps[index];
  const cardW = Math.max(0, metrics.width - metrics.peek * 2);
  const step = cardW + metrics.gap;

  useLayoutEffect(() => {
    if (busyRef.current) return;
    setMotion(false);
  }, [metrics.width, metrics.peek, metrics.gap]);

  useEffect(() => {
    if (metrics.width <= 0) return;
    const frame = requestAnimationFrame(() => setMotion(true));
    return () => cancelAnimationFrame(frame);
  }, [metrics.width, metrics.peek, metrics.gap]);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    if (metrics.peek > 0 || metrics.width <= 0) {
      viewport.style.height = "";
      return;
    }
    const node = stageRefs.current[index];
    if (!node) return;
    const apply = () => {
      const next = node.offsetHeight;
      if (next > 0) viewport.style.height = `${next}px`;
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(node);
    return () => observer.disconnect();
  }, [index, metrics.peek, metrics.width]);

  useEffect(() => {
    const node = viewportRef.current;
    if (!node) return;
    const read = () => {
      const desktop = window.matchMedia("(min-width: 981px)").matches;
      const next = {
        width: node.clientWidth,
        peek: desktop ? DESKTOP_PEEK : 0,
        gap: desktop ? DESKTOP_GAP : 0,
      };
      setMetrics((prev) => (prev.width === next.width && prev.peek === next.peek && prev.gap === next.gap ? prev : next));
    };
    read();
    const observer = new ResizeObserver(read);
    observer.observe(node);
    const query = window.matchMedia("(min-width: 981px)");
    query.addEventListener("change", read);
    return () => {
      observer.disconnect();
      query.removeEventListener("change", read);
    };
  }, []);

  function goTo(target: number) {
    if (count < 2 || busyRef.current) return;
    const from = indexRef.current;
    const next = ((target % count) + count) % count;
    if (next === from) return;
    let delta = next - from;
    if (delta > count / 2) delta -= count;
    if (delta < -count / 2) delta += count;
    const dest = from + delta;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    indexRef.current = next;
    setIndex(next);
    if (reduce || step <= 0) {
      posRef.current = next;
      setAnchor(next);
      setTrackPos(next);
      setMotion(false);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setMotion(true));
      });
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setMotion(true);
    setAnchor(from);
    posRef.current = dest;
    setTrackPos(dest);
  }

  function onTrackEnd(event: React.TransitionEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget || event.propertyName !== "transform") return;
    const pos = posRef.current;
    const settled = ((pos % count) + count) % count;
    if (settled !== pos) {
      posRef.current = settled;
      indexRef.current = settled;
      setMotion(false);
      setAnchor(settled);
      setTrackPos(settled);
      setIndex(settled);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setMotion(true);
          busyRef.current = false;
          setBusy(false);
        });
      });
      return;
    }
    busyRef.current = false;
    setBusy(false);
  }

  const goToRef = useRef<(target: number) => void>(() => {});
  useEffect(() => {
    goToRef.current = goTo;
  });

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT")) return;
      if (event.key === "ArrowRight") {
        event.preventDefault();
        goToRef.current(indexRef.current + 1);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        goToRef.current(indexRef.current - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function cardShift(itemIndex: number): string | undefined {
    if (step <= 0) return undefined;
    const low = Math.min(anchor, trackPos) - 1;
    const high = Math.max(anchor, trackPos) + 1;
    if (itemIndex >= low && itemIndex <= high) return undefined;
    let placed: number | null = null;
    let best = Infinity;
    for (const turn of [-1, 1]) {
      const pos = itemIndex + turn * count;
      if (pos < low || pos > high) continue;
      const dist = Math.abs(pos - trackPos);
      if (dist < best) {
        best = dist;
        placed = pos;
      }
    }
    if (placed === null) return undefined;
    return `translate3d(${(placed - itemIndex) * step}px, 0, 0)`;
  }

  return (
    <div className="app">
      <header className="site-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">✦</span>
          Comfy API Apps
        </div>
        <div className="header-actions">{mock ? <span className="mockpill">Mock mode</span> : null}</div>
      </header>
      <main className="page">
        <div className="hero">
          <h1>{current?.name}</h1>
          <p>Fun apps powered by ComfyUI</p>
        </div>
        {!mock && !configured ? (
          <p className="warn">Set COMFY_API_KEY or COMFY_CLOUD_API_KEY on the server to run live jobs, or COMFY_MOCK=1 for sample output.</p>
        ) : null}
        <nav className="header-nav" aria-label="Apps">
          {apps.map((item, itemIndex) => (
            <button key={item.id} type="button" className={itemIndex === index ? "on" : ""} onClick={() => goTo(itemIndex)}>
              {item.name}
            </button>
          ))}
        </nav>
        <div className="stage-wrap">
          <button className="nav-arrow prev" type="button" aria-label="Previous app" onClick={() => goTo(index - 1)}>
            ‹
          </button>
          <div className="track-viewport" ref={viewportRef}>
            <div
              className="track"
              onTransitionEnd={onTrackEnd}
              style={{
                gap: metrics.gap,
                transform: `translate3d(${metrics.peek - trackPos * step}px, 0, 0)`,
                transition: motion ? `transform ${NAV_S}s ${SLIDE_EASE}` : "none",
                pointerEvents: busy ? "none" : undefined,
              }}
            >
              {apps.map((item, itemIndex) => (
                <div
                  key={item.id}
                  className="stage"
                  ref={(node) => {
                    stageRefs.current[itemIndex] = node;
                  }}
                  style={{ width: cardW || "100%", transform: cardShift(itemIndex) }}
                >
                  <div className="stage-body" inert={itemIndex !== index}>
                    <AppCard app={item} />
                  </div>
                </div>
              ))}
            </div>
            {metrics.peek > 0 ? (
              <>
                <button
                  type="button"
                  className="peek-zone prev"
                  style={{ width: metrics.peek }}
                  aria-label={`Show ${apps[(index + count - 1) % count]?.name ?? "previous app"}`}
                  onClick={() => goTo(index - 1)}
                />
                <button
                  type="button"
                  className="peek-zone next"
                  style={{ width: metrics.peek }}
                  aria-label={`Show ${apps[(index + 1) % count]?.name ?? "next app"}`}
                  onClick={() => goTo(index + 1)}
                />
              </>
            ) : null}
          </div>
          <button className="nav-arrow next" type="button" aria-label="Next app" onClick={() => goTo(index + 1)}>
            ›
          </button>
        </div>
        <div className="dots">
          <p className="foot-note">The API key stays on the server. Arrow keys move between apps.</p>
          <div className="dotrow">
            {apps.map((item, itemIndex) => (
              <button key={item.id} type="button" className={itemIndex === index ? "on" : ""} aria-label={item.name} onClick={() => goTo(itemIndex)} />
            ))}
            <span className="count">
              {index + 1} / {count}
            </span>
          </div>
        </div>
      </main>
      <footer className="site-footer">
        <p>
          Fun apps made by{" "}
          <a href="https://x.com/ojotapcosta" target="_blank" rel="noopener noreferrer">
            JP Costa
          </a>
          .
        </p>
        <p>
          Powered by{" "}
          <a href="https://www.comfy.org/" target="_blank" rel="noopener noreferrer">
            ComfyUI
          </a>{" "}
          on{" "}
          <a href="https://cloud.comfy.org/" target="_blank" rel="noopener noreferrer">
            Comfy Cloud
          </a>
          .
        </p>
      </footer>
    </div>
  );
}
