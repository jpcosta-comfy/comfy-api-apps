"use client";

import { useEffect } from "react";

export function RequestModal({
  request,
  idempotencyKey,
  onClose,
}: {
  request: unknown;
  idempotencyKey: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const json = JSON.stringify(request, null, 2);

  return (
    <div className="backdrop" onClick={onClose} role="presentation">
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="request-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <h2 id="request-title">Request</h2>
            <div className="sub">Body sent to Comfy Cloud. The API key is redacted.</div>
          </div>
          <button className="btn" type="button" onClick={onClose}>
            Close
          </button>
        </header>
        <div className="reqline">
          <span className="verb">POST</span>
          <span>/api/v2/jobs</span>
        </div>
        <div className="reqline">
          <span>Idempotency-Key</span>
          <span>{idempotencyKey}</span>
        </div>
        <pre className="json">{json}</pre>
      </div>
    </div>
  );
}
