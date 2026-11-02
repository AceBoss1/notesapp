"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMember } from "@/lib/member-client";
import { cleanShareRef, signInHref, type ShareRef } from "@/lib/share-targets";
import { MomentShareSheet, startJournalDraft } from "@/components/share/ShareToNotesApp";

// Where "Share to Moments" / "Share to Journals" finish when they couldn't on the spot: after a visitor signs in (?next=/share?…), and
// from a member's own domain. /share?to=moment|journal&kind=<journal|course|certificate|coupon|post>&id=<id>
export default function SharePage() {
  const { user } = useMember();
  const router = useRouter();
  const [ask, setAsk] = useState<{ to: string; ref: ShareRef | null } | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setAsk({ to: q.get("to") === "journal" ? "journal" : "moment", ref: cleanShareRef({ kind: q.get("kind"), id: q.get("id") ?? "" }) });
  }, []);
  useEffect(() => {
    if (!ask?.ref || !user || ask.to !== "journal") return;
    startJournalDraft(ask.ref, (h) => router.replace(h)).catch((e) => setErr(e instanceof Error ? e.message : "Couldn't start the draft."));
  }, [ask, user, router]);

  let body: React.ReactNode;
  if (!ask || user === undefined) body = <p className="text-sm text-slate">Loading…</p>;
  else if (!ask.ref) body = <p className="text-sm text-slate">That share link isn&apos;t complete. Go back and tap Share again.</p>;
  else if (!user) body = (
    <div className="card p-6">
      <h1 className="font-display text-3xl text-ink">Sign in to share</h1>
      <p className="mt-2 text-sm text-slate">Sharing to your Moments or your journal is for #NotesApp members.</p>
      <a href={signInHref(ask.to as "moment" | "journal", ask.ref)} className="btn-primary mt-5 inline-flex !px-5 !py-2.5 text-sm">Sign in</a>
    </div>
  );
  else if (ask.to === "journal") body = err ? <p role="alert" className="text-sm text-crimson">{err}</p> : <p className="text-sm text-slate">Starting your draft…</p>;
  else body = <MomentShareSheet shareRef={ask.ref} inline onClose={() => router.push("/journals")} />;
  return <section className="mx-auto max-w-xl px-4 py-14">{body}</section>;
}
