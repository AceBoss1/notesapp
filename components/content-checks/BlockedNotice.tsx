"use client";

import { useState } from "react";
import Link from "next/link";
import { appealCheck } from "@/lib/content-checks-client";
import type { CheckDetail } from "@/lib/content-checks";

// What a member sees when a content check stops a post (screen 2 of the approved mockups): what was found and where, the strike, and
// "Remove the photo" / "Ask for a review". The post stays as a draft (the journal) or in the composer, so they can fix it.
export default function BlockedNotice({ detail, onRemovePhoto, onClose }: { detail: CheckDetail; onRemovePhoto?: (url: string | undefined, item: string | undefined) => void; onClose?: () => void }) {
  const [asked, setAsked] = useState<"" | "busy" | "done" | string>("");
  const photo = !!detail.item?.startsWith("picture") && !!onRemovePhoto;
  const paused = detail.outcome === "paused" || detail.outcome === "banned";
  async function ask() {
    if (!detail.flagId) return;
    setAsked("busy");
    try { await appealCheck(detail.flagId); setAsked("done"); }
    catch (e) { setAsked(e instanceof Error ? e.message : "Couldn't ask just now."); }
  }
  return (
    <div role="alert" className="grid gap-2">
      <div className={`rounded-2xl border p-3 text-sm leading-relaxed ${detail.outcome === "held" ? "border-amber-500/40 bg-amber-500/10" : "border-crimson/30 bg-crimson/5"} text-ink`}>
        <p className="font-ui font-bold text-crimson">{detail.title}</p>
        <p className="mt-0.5">{detail.message}</p>
      </div>
      {!paused && (
        <div className="flex gap-2">
          {photo && <button type="button" onClick={() => { onRemovePhoto!(detail.url, detail.item); onClose?.(); }} className="flex-1 rounded-full border border-rule bg-card px-4 py-2 font-ui text-sm font-bold text-ink">Remove the photo</button>}
          {detail.outcome === "blocked" && detail.flagId && (
            asked === "done"
              ? <p className="flex-1 self-center text-xs text-slate">Thanks. A person will look at it within 48 hours, and we&apos;ll tell you what they decide.</p>
              : <button type="button" disabled={asked === "busy"} onClick={ask} className="flex-1 rounded-full border border-rule bg-card px-4 py-2 font-ui text-sm font-bold text-ink disabled:opacity-50">{asked === "busy" ? "Asking…" : "Ask for a review"}</button>
          )}
        </div>
      )}
      {asked && asked !== "busy" && asked !== "done" && <p className="text-xs text-crimson">{asked}</p>}
      <p className="text-xs text-slate">{paused ? <>See <Link href="/profile/account#content-checks" className="text-crimson underline">your account page</Link> for your strikes and to appeal.</> : "Checking takes a second or two while you post. The text, and every photo or video in the post, are checked together."}</p>
    </div>
  );
}
