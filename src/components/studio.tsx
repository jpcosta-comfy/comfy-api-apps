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
        <div className="logo">
          <img className="logo-full" src="/comfy-logo.svg" alt="Comfy" />
        </div>
        <nav className="header-nav" aria-label="Apps">
          {apps.map((item, itemIndex) => (
            <button key={item.id} type="button" className={itemIndex === index ? "on" : ""} onClick={() => setIndex(itemIndex)}>
              {item.name}
            </button>
          ))}
        </nav>
        <div className="header-actions">{mock ? <span className="mockpill">Mock mode</span> : null}</div>
      </header>
      <main className="page">
      {!mock && !configured ? (
        <p className="warn">Set COMFY_API_KEY or COMFY_CLOUD_API_KEY on the server to run live jobs, or COMFY_MOCK=1 for sample output.</p>
      ) : null}
      <div className="stage-wrap">
        {apps.map((item, itemIndex) => (
          <div key={item.id} className="stage" hidden={itemIndex !== index}>
            <AppCard app={item} />
          </div>
        ))}
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
    </div>
  );
}
