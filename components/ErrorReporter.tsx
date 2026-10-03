"use client";

import { useEffect } from "react";

// Sends uncaught browser errors and unhandled promise rejections to /api/errors (see lib/monitoring.ts).
// At most 5 per page load, and the same message only once, so a loop can't flood the endpoint.
export function sendClientError(message: string, stack?: string) {
  try {
    const sent = ((window as unknown as { __naErrs?: Set<string> }).__naErrs ??= new Set<string>());
    if (sent.size >= 5 || sent.has(message)) return;
    sent.add(message);
    fetch("/api/errors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, stack, url: window.location.href }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* monitoring must never break the page */
  }
}

export default function ErrorReporter() {
  useEffect(() => {
    const onError = (e: ErrorEvent) => {
      // Cross-origin script noise ("Script error.") and extension errors carry no useful information.
      if (!e.message || e.message === "Script error." || /extension:\/\//.test(e.filename || "")) return;
      sendClientError(e.message, e.error?.stack);
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      const r = e.reason;
      sendClientError(r instanceof Error ? r.message : `Unhandled rejection: ${String(r)}`, r instanceof Error ? r.stack : undefined);
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
