"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AppCard } from "@/components/app-card";
import { easeSlide, NAV_MS } from "@/lib/ease-slide";
import type { CatalogApp } from "@/lib/types";

function mod(value: number, count: number): number {
  return ((value % count) + count) % count;
}

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
  const reelRef = useRef<HTMLDivElement>(null);
  const stageRefs = useRef<Array<HTMLDivElement | null>>([]);
  const widthRef = useRef(0);
  const indexRef = useRef(0);
  const posRef = useRef(0);
  const busyRef = useRef(false);
  const animRef = useRef<{ from: number; to: number; t0: number } | null>(null);
  const rafRef = useRef(0);
  const [index, setIndex] = useState(0);
  const [trackPos, setTrackPos] = useState(0);
  const [anchor, setAnchor] = useState(0);
  const [busy, setBusy] = useState(false);
  const [width, setWidth] = useState(0);

  const current = apps[index];
  const cardW = Math.max(0, width);
  const step = cardW;

  function paint(pos: number) {
    const reel = reelRef.current;
    const size = widthRef.current;
    if (!reel || size <= 0) return;
    reel.style.transform = `translate3d(${-pos * size}px, 0, 0)`;
  }

  function finish(to: number) {
    const settled = mod(to, count);
    animRef.current = null;
    posRef.current = settled;
    indexRef.current = settled;
    busyRef.current = false;
    setIndex(settled);
    setAnchor(settled);
    setTrackPos(settled);
    setBusy(false);
    if (settled === to) paint(settled);
  }

  function frame(now: number) {
    const anim = animRef.current;
    if (!anim) return;
    const t = (now - anim.t0) / NAV_MS;
    if (t >= 1) {
      finish(anim.to);
      return;
    }
    const pos = anim.from + (anim.to - anim.from) * easeSlide(t);
    posRef.current = pos;
    paint(pos);
    rafRef.current = requestAnimationFrame(frame);
  }

  useLayoutEffect(() => {
    if (animRef.current) return;
    paint(trackPos);
  }, [trackPos, width]);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const desktop = window.matchMedia("(min-width: 981px)").matches;
    if (desktop || width <= 0) {
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
  }, [index, width]);

  useLayoutEffect(() => {
    const node = viewportRef.current;
    if (!node) return;
    const read = () => {
      const next = node.clientWidth;
      if (widthRef.current === next) return;
      widthRef.current = next;
      if (animRef.current) {
        cancelAnimationFrame(rafRef.current);
        animRef.current = null;
        const settled = mod(indexRef.current, count);
        posRef.current = settled;
        busyRef.current = false;
        setBusy(false);
        setAnchor(settled);
        setTrackPos(settled);
      }
      setWidth(next);
    };
    read();
    const observer = new ResizeObserver(read);
    observer.observe(node);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(rafRef.current);
    };
  }, [count]);

  function goTo(target: number) {
    if (count < 2 || busyRef.current) return;
    const from = indexRef.current;
    const next = mod(target, count);
    if (next === from) return;
    let delta = next - from;
    if (delta > count / 2) delta -= count;
    if (delta < -count / 2) delta += count;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    indexRef.current = next;
    setIndex(next);
    cancelAnimationFrame(rafRef.current);
    if (reduce || widthRef.current <= 0) {
      animRef.current = null;
      posRef.current = next;
      busyRef.current = false;
      setBusy(false);
      setAnchor(next);
      setTrackPos(next);
      return;
    }
    const fromPos = posRef.current;
    const dest = fromPos + delta;
    busyRef.current = true;
    setBusy(true);
    animRef.current = { from: fromPos, to: dest, t0: performance.now() };
    setAnchor(fromPos);
    setTrackPos(dest);
    rafRef.current = requestAnimationFrame(frame);
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
              className="reel"
              ref={reelRef}
              style={{ pointerEvents: busy ? "none" : undefined }}
            >
              {apps.map((item, itemIndex) => (
                <div
                  key={item.id}
                  className="stage"
                  ref={(node) => {
                    stageRefs.current[itemIndex] = node;
                  }}
                  style={{
                    width: cardW || "100%",
                    flexBasis: cardW || "100%",
                    maxWidth: cardW || "100%",
                    transform: cardShift(itemIndex),
                  }}
                >
                  <div className="stage-body" inert={itemIndex !== index}>
                    <AppCard app={item} />
                  </div>
                </div>
              ))}
            </div>
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
          <a href="https://x.com/jp_costa" target="_blank" rel="noopener noreferrer">
            JP Costa
          </a>
          .
        </p>
        <p>
          Powered by{" "}
          <a href="https://comfy.org/platform/comfy-api/" target="_blank" rel="noopener noreferrer">
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
