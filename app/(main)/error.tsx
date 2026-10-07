"use client";

import { useEffect } from "react";
import Link from "next/link";
import { sendClientError } from "@/components/ErrorReporter";

// The page itself crashed (a rendering error). The visitor gets a calm way forward and the error
// is recorded for /admin/errors.
export default function PageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    sendClientError(error.message || "Page error", error.stack);
    // Right after a release, a phone that still holds the old page can fail to load a new script ("ChunkLoadError"). One
    // reload fetches the new version; the flag stops it from reloading in a loop if something else is wrong.
    if (/ChunkLoadError|Loading chunk|Loading CSS chunk|dynamically imported module|Importing a module script failed/i.test(`${error.name} ${error.message}`)) {
      try {
        const last = Number(sessionStorage.getItem("na-chunk-reload") || 0);
        if (Date.now() - last > 60_000) {
          sessionStorage.setItem("na-chunk-reload", String(Date.now()));
          window.location.reload();
        }
      } catch { /* no storage: the buttons below still work */ }
    }
  }, [error]);
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <p className="font-display text-2xl text-ink">Something went wrong on this page</p>
      <p className="mt-3 text-sm text-slate">We&apos;ve been told about it. Try again, or go back home — your payments and data are safe.</p>
      <div className="mt-6 flex justify-center gap-3">
        <button onClick={reset} className="btn-primary !px-5 !py-2 text-sm">Try again</button>
        <Link href="/" className="btn-ghost !px-5 !py-2 text-sm">Home</Link>
      </div>
    </div>
  );
}
