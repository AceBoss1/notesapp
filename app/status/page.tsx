"use client";

import { useEffect, useState } from "react";

type Service = { id: string; name: string; description: string; state: "operational" | "degraded" | "down" | "not_configured"; latencyMs?: number };
type Data = { overall: "operational" | "degraded" | "outage"; checkedAt: string; services: Service[] };

const BANNER = {
  operational: { text: "All systems operational", cls: "bg-emerald-50 text-emerald-900 border-emerald-200" },
  degraded: { text: "Some services are slow", cls: "bg-amber-50 text-amber-900 border-amber-200" },
  outage: { text: "Some services are down", cls: "bg-red-50 text-red-900 border-red-200" },
};
const LABEL = { operational: "Operational", degraded: "Slow", down: "Down", not_configured: "Not enabled yet" };
const DOT = { operational: "bg-emerald-500", degraded: "bg-amber-500", down: "bg-red-600", not_configured: "bg-slate/40" };

export default function StatusPage() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/status", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d) => alive && (setData(d), setError(false)))
        .catch(() => alive && setError(true));
    load();
    const t = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  return (
    <section className="mx-auto max-w-2xl px-4 py-14 sm:px-6">
      <span className="eyebrow">Status</span>
      <h1 className="mt-3 font-display text-4xl text-ink">#NotesApp service status</h1>

      {error && !data && (
        <p className="mt-8 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          We couldn't reach the status service — the site itself may be having problems.
        </p>
      )}
      {!data && !error && <p className="mt-8 text-sm text-slate">Checking services…</p>}

      {data && (
        <>
          <p className={`mt-8 border px-4 py-3 font-ui text-sm font-semibold ${BANNER[data.overall].cls}`}>{BANNER[data.overall].text}</p>
          <ul className="mt-6 divide-y divide-rule border border-rule">
            {data.services.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-4 px-4 py-4">
                <div>
                  <p className="font-ui text-sm font-bold text-ink">{s.name}</p>
                  <p className="text-xs text-slate">{s.description}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2 text-right">
                  <span className={`h-2.5 w-2.5 rounded-full ${DOT[s.state]}`} />
                  <span className="text-sm text-ink">{LABEL[s.state]}</span>
                  {s.latencyMs !== undefined && s.state !== "not_configured" && s.id !== "web" && (
                    <span className="font-mono text-xs text-slate">{s.latencyMs} ms</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-slate">
            Live checks, refreshed every minute · last checked {new Date(data.checkedAt).toLocaleTimeString()}.
            Problems? Email hello@notesapp.name.ng.
          </p>
        </>
      )}
    </section>
  );
}
