"use client";
import { useEffect, useState } from "react";
import { PREP_NAME } from "@/lib/exam-prep";
import { prepApi, useMe, usePrepHref } from "@/lib/exam-prep-client";
import { btnGo, card, Note, PLink } from "@/components/exam-prep/ui";

// An outside reviewer's invite link: sign in (or create an account), then accept.
export default function InvitePage() {
  const me = useMe();
  const h = usePrepHref();
  const [state, setState] = useState<"idle" | "busy" | "ok" | string>("idle");
  const [t, setT] = useState("");
  useEffect(() => setT(new URLSearchParams(window.location.search).get("t") || ""), []);
  async function accept() { setState("busy"); try { await prepApi("invite", { body: { token: t } }); setState("ok"); } catch (e) { setState((e as Error).message); } }
  const here = `${h("/review/invite")}?t=${encodeURIComponent(t)}`;
  return (
    <div className={`${card} mx-auto max-w-md`}>
      <h1 className="font-display text-2xl font-bold">Review questions for {PREP_NAME}</h1>
      <p className="mt-2 text-[15px] text-[#0F2747]/80">You've been invited to check practice questions before students see them: is the answer right, is the explanation clear, is it fair? You'll see the review queue only.</p>
      {state === "ok" ? <div className="mt-4 space-y-3"><Note tone="ok">You're a reviewer now. Thank you!</Note><PLink href="/review" className={btnGo}>Open the review queue</PLink></div>
        : me === null ? <a href={h(`/signin?next=${encodeURIComponent(here)}`)} className={`${btnGo} mt-4`}>Sign in or create an account</a>
        : <button onClick={accept} disabled={!me || state === "busy" || !t} className={`${btnGo} mt-4`}>{state === "busy" ? "Accepting…" : "Accept the invite"}</button>}
      {state !== "idle" && state !== "busy" && state !== "ok" && <div className="mt-3"><Note tone="error">{state}</Note></div>}
    </div>
  );
}
