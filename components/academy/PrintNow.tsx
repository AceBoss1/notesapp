"use client";

import { useEffect } from "react";

// Opens the print dialog once the certificate's pictures have loaded ("Save as PDF" is the default printer on phones and computers).
export default function PrintNow() {
  useEffect(() => {
    const go = () => setTimeout(() => window.print(), 300);
    if (document.readyState === "complete") go(); else window.addEventListener("load", go, { once: true });
  }, []);
  return <p className="fixed bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-ink/80 px-4 py-2 text-xs text-white print:hidden">Choose “Save as PDF” in the print dialog.</p>;
}
