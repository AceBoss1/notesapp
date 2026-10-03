"use client";

import { useEffect } from "react";
import Link from "next/link";
import { sendClientError } from "@/components/ErrorReporter";

// The page itself crashed (a rendering error). The visitor gets a calm way forward and the error
// is recorded for /admin/errors.
export default function PageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    sendClientError(error.message || "Page error", error.stack);
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
