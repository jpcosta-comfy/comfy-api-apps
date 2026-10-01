"use client";

import { useEffect, useState } from "react";
import { AppCard } from "@/components/app-card";
import type { CatalogApp } from "@/lib/types";

export function Studio({
  apps,
  mock,
  configured,
}: {
  apps: CatalogApp[];
  mock: boolean;
  configured: boolean;
}) {
  const [index, setIndex] = useState(0);
  const count = apps.length;
  const countWord = COUNT_WORDS[count] ?? String(count);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT")) return;
      if (event.key === "ArrowRight") {
        event.preventDefault();
        setIndex((current) => (current + 1) % count);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        setIndex((current) => (current - 1 + count) % count);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [count]);

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
          <h1>Use it anywhere</h1>
          <p>
            {countWord} {count === 1 ? "app" : "apps"} on the Comfy Cloud API. Any image you upload.
          </p>
        </div>
        {!mock && !configured ? (
          <p className="warn">Set COMFY_API_KEY or COMFY_CLOUD_API_KEY on the server to run live jobs, or COMFY_MOCK=1 for sample output.</p>
        ) : null}
        <nav className="header-nav" aria-label="Apps">
          {apps.map((item, itemIndex) => (
            <button key={item.id} type="button" className={itemIndex === index ? "on" : ""} onClick={() => setIndex(itemIndex)}>
              {item.name}
            </button>
          ))}
        </nav>
        <div className="stage-wrap">
          <button className="nav-arrow prev" type="button" aria-label="Previous app" onClick={() => setIndex((current) => (current - 1 + count) % count)}>
            ‹
          </button>
          {apps.map((item, itemIndex) => (
            <div key={item.id} className="stage" hidden={itemIndex !== index}>
              <AppCard app={item} />
            </div>
          ))}
          <button className="nav-arrow next" type="button" aria-label="Next app" onClick={() => setIndex((current) => (current + 1) % count)}>
            ›
          </button>
        </div>
        <div className="dots">
          <p className="foot-note">The API key stays on the server. Arrow keys move between apps.</p>
          <div className="dotrow">
            {apps.map((item, itemIndex) => (
              <button key={item.id} type="button" className={itemIndex === index ? "on" : ""} aria-label={item.name} onClick={() => setIndex(itemIndex)} />
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

const COUNT_WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];
