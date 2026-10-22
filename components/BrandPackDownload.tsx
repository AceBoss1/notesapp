"use client";
import { useState } from "react";
import { BRAND_PACK } from "@/lib/brand-guidelines";

// The logo pack: a tick that the guidelines are read and accepted, then the zip.
export default function BrandPackDownload() {
  const [ok, setOk] = useState(false);
  return (
    <div className="mt-4">
      <label className="flex items-start gap-2 text-sm text-ink">
        <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} className="mt-1" />
        I&apos;ve read and accept the NotesApp brand guidelines on this page and the Terms of Service.
      </label>
      {ok ? (
        <a href={BRAND_PACK.file} download className="btn-primary mt-4 inline-block !px-6 !py-2 text-sm">Download the logo pack (zip)</a>
      ) : (
        <span aria-disabled className="mt-4 inline-block cursor-not-allowed rounded-full bg-rule px-6 py-2 font-ui text-sm font-semibold text-slate">Download the logo pack (zip)</span>
      )}
    </div>
  );
}
