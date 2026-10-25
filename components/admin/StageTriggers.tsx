"use client";

import { useCallback, useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { useAdminCall } from "@/lib/useAdminCall";
import type { Status, Trigger } from "@/lib/ops-metrics";

const CHIP: Record<Status, string> = {
  crossed: "bg-red-50 text-red-800 border-red-200",
  near: "bg-amber-50 text-amber-800 border-amber-200",
  ok: "bg-emerald-50 text-emerald-800 border-emerald-200",
  unknown: "bg-paper text-slate border-rule",
};
const WORD: Record<Status, string> = { crossed: "Line crossed", near: "Getting close", ok: "Below the line", unknown: "Not measured yet" };
const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Africa/Lagos" });

// The five numbers that start each stage of the speed and infrastructure plan (lib/ops-metrics.ts), on the admin dashboard,
// so the triggers are watched rather than guessed. Super admins, product & tech and engineering.
export default function StageTriggers({ user }: { user: User }) {
  const call = useAdminCall(user, "/api/admin/triggers");
  const [data, setData] = useState<{ triggers: Trigger[]; asOf: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async (fresh: boolean) => {
    setBusy(true); setError("");
    try { setData(await call(undefined, fresh ? "?fresh=1" : "")); } catch (e) { setError(e instanceof Error ? e.message : "Couldn't load the numbers"); } finally { setBusy(false); }
  }, [call]);
  useEffect(() => { void load(false); }, [load]);

  return (
    <div className="mt-8 border border-rule bg-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="eyebrow">When to grow the infrastructure</p>
          <p className="mt-1 text-sm text-slate">Five numbers from the speed and infrastructure plan. When one crosses its line, the stage beside it starts.</p>
        </div>
        <button onClick={() => load(true)} disabled={busy} className="font-ui text-xs font-semibold text-crimson-bright hover:text-ink disabled:opacity-50">{busy ? "Counting…" : data ? `As of ${when(data.asOf)} · Count again` : "Count"}</button>
      </div>
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
      {!data ? !error && <p className="mt-4 text-sm text-slate">Loading…</p> : (
        <ul className="mt-4 divide-y divide-rule">
          {data.triggers.map((t) => (
            <li key={t.key} className="grid gap-3 py-4 sm:grid-cols-[1fr_auto]">
              <div className="min-w-0">
                <p className="font-ui text-sm font-semibold text-ink">{t.title}</p>
                <p className="mt-0.5 text-xs text-slate">Line: {t.line} · <span className="font-semibold">Stage {t.stage}</span></p>
                <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
                  {t.parts.map((p) => (
                    <li key={p.label} className="text-sm">
                      <span className="block text-xs text-slate">{p.label}</span>
                      <span className={`font-display text-xl ${p.status === "crossed" ? "text-red-700" : p.status === "near" ? "text-amber-700" : "text-ink"}`}>{p.value}</span>
                      {p.note && <span className="block text-[11px] text-slate">{p.note}</span>}
                    </li>
                  ))}
                </ul>
              </div>
              <span className={`order-first h-fit w-fit self-start justify-self-start whitespace-nowrap rounded-full border px-3 py-1 font-ui text-[11px] font-semibold sm:order-none sm:justify-self-end ${CHIP[t.status]}`}>{WORD[t.status]}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
