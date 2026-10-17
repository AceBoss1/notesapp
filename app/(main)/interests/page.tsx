"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PageHero from "@/components/PageHero";
import TopicPicker from "@/components/TopicPicker";
import { MAX_INTERESTS, MIN_INTERESTS } from "@/lib/topics";
import { saveInterests, useInterests } from "@/lib/interests-client";

// Choose your interests: the topics the journal feed and the weekly digest put first (users/{uid}.interests, lib/topics.ts).
// The weekly digest's "Choose your interests" link lands here.
export default function InterestsPage() {
  const { interests, signedIn } = useInterests();
  const [value, setValue] = useState<string[]>([]);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState("");
  useEffect(() => { if (interests) setValue(interests); }, [interests]);

  async function save() {
    setState("saving"); setError("");
    try { setValue(await saveInterests(value)); setState("saved"); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn't save that."); setState("error"); }
  }
  const changed = JSON.stringify(value) !== JSON.stringify(interests ?? []);

  return (
    <>
      <PageHero compact max="max-w-3xl" eyebrow="Your feed" title={<>Choose your interests</>}>
        <p>Pick the topics you want to read about. Journals on them come first in your feed and in the weekly digest. Choose at least {MIN_INTERESTS}; you can change them any time.</p>
      </PageHero>
      <section className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        {!signedIn ? (
          <p className="card p-6 text-sm text-slate"><Link href="/login?next=/interests" className="font-semibold text-crimson">Sign in</Link> to choose your interests.</p>
        ) : interests === null ? (
          <p className="text-sm text-slate">Loading…</p>
        ) : (
          <>
            <TopicPicker value={value} onChange={(v) => { setValue(v); setState("idle"); }} max={MAX_INTERESTS} />
            <div className="sticky bottom-0 -mx-4 mt-6 flex flex-wrap items-center gap-3 border-t border-rule bg-paper/95 px-4 py-4 backdrop-blur sm:mx-0 sm:px-0">
              <button onClick={save} disabled={state === "saving" || !changed} className="btn-primary !px-6 !py-2.5 text-sm">{state === "saving" ? "Saving…" : "Save my interests"}</button>
              {state === "saved" && <span className="text-sm text-emerald-800">Saved. <Link href="/journals" className="font-semibold underline">See your feed</Link></span>}
              {value.length > 0 && value.length < MIN_INTERESTS && <span className="text-xs text-slate">Tip: {MIN_INTERESTS - value.length} more makes a better feed.</span>}
              {error && <span className="text-sm text-crimson">{error}</span>}
            </div>
          </>
        )}
      </section>
    </>
  );
}
