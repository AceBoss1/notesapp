"use client";

import { useEffect, useState } from "react";
import PageHero from "@/components/PageHero";

type Service = { id: string; name: string; description: string; state: "operational" | "degraded" | "down" | "not_configured"; latencyMs?: number };
type Incident = { id: string; startedAt: string; resolvedAt: string | null; services: string[]; worst: "degraded" | "down" };
type Data = { overall: "operational" | "degraded" | "outage"; checkedAt: string; services: Service[]; incidents?: Incident[] };

const MAX_SAMPLES = 24;
const HISTORY_KEY = "notesapp-status-rtt";
const barColor = (ms: number) => (ms >= 2000 ? "bg-red-500" : ms >= 800 ? "bg-amber-400" : "bg-emerald-500");

function loadHistory(): number[] {
  try {
    const raw = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    return Array.isArray(raw) ? raw.filter((n) => typeof n === "number").slice(-MAX_SAMPLES) : [];
  } catch {
    return [];
  }
}

function SubscribeBox() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("busy");
    setError(null);
    try {
      const res = await fetch("/api/status/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Couldn't subscribe — try again.");
      setState("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't subscribe — try again.");
      setState("idle");
    }
  }

  return (
    <div className="mt-10 border border-rule px-5 py-6 text-center">
      <h2 className="font-display text-2xl text-ink">Subscribe to updates</h2>
      <p className="mt-2 text-sm text-slate">Get an email when an incident starts or is resolved.</p>
      {state === "done" ? (
        <p className="mt-4 text-sm font-semibold text-emerald-800">You're subscribed. Every update has a one-click unsubscribe link.</p>
      ) : (
        <form onSubmit={submit} className="mx-auto mt-4 flex max-w-sm flex-col gap-2 sm:flex-row">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="min-w-0 flex-1 border border-rule bg-card px-3 py-2 text-sm outline-none focus:border-crimson"
          />
          <button disabled={state === "busy"} className="btn-primary !px-5 !py-2 text-xs disabled:opacity-50">
            {state === "busy" ? "Subscribing…" : "Subscribe via email"}
          </button>
        </form>
      )}
      {error && <p className="mt-3 text-xs text-crimson">{error}</p>}
    </div>
  );
}

const fmtDuration = (a: string, b: string) => {
  const min = Math.max(1, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60_000));
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${min % 60} min`;
};

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
  const [samples, setSamples] = useState<number[]>([]);

  useEffect(() => {
    let alive = true;
    setSamples(loadHistory());
    const load = () => {
      const start = performance.now();
      return fetch("/api/status", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d) => {
          if (!alive) return;
          const ms = Math.round(performance.now() - start);
          setData(d);
          setError(false);
          setSamples((prev) => {
            const next = [...prev, ms].slice(-MAX_SAMPLES);
            try {
              localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
            } catch {}
            return next;
          });
        })
        .catch(() => alive && setError(true));
    };
    load();
    const t = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  return (
    <>
      <PageHero eyebrow="Status" title={<>#NotesApp service status</>} />
      <section className="mx-auto max-w-2xl px-4 py-12 sm:px-6">

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

          <h2 className="mt-12 font-display text-2xl text-ink">Recent response times</h2>
          <p className="mt-1 text-sm text-slate">Live API round-trip per check, measured by your browser.</p>
          <div className="mt-4 flex h-24 items-end gap-1.5" role="img" aria-label="Recent response times">
            {samples.map((ms, i) => (
              <div
                key={i}
                title={`${ms} ms`}
                className={`min-w-0 flex-1 rounded-sm ${barColor(ms)}`}
                style={{ height: `${Math.max(8, Math.min(100, (ms / 3000) * 100))}%` }}
              />
            ))}
          </div>
          <p className="mt-2 text-xs text-slate">Green under 0.8 s · amber under 2 s · red slower. History stays on this device.</p>

          <h2 className="mt-12 font-display text-2xl text-ink">Incident history</h2>
          {data.incidents && data.incidents.length > 0 ? (
            <ul className="mt-4 divide-y divide-rule border border-rule">
              {data.incidents.map((i) => (
                <li key={i.id} className="px-4 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-ui text-sm font-bold text-ink">
                      {i.services.join(", ")} — {i.worst === "down" ? "outage" : "slow"}
                    </p>
                    <span className={`text-xs font-semibold ${i.resolvedAt ? "text-emerald-800" : "text-crimson"}`}>
                      {i.resolvedAt ? `Resolved after ${fmtDuration(i.startedAt, i.resolvedAt)}` : "Ongoing"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate">{new Date(i.startedAt).toLocaleString()}</p>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-4 border border-rule px-4 py-8 text-center">
              <p className="text-ink">No incidents recorded.</p>
              <p className="mt-1 text-xs text-slate">This page has only tracked live status since launch — history builds from here.</p>
            </div>
          )}

          <SubscribeBox />
        </>
      )}
    </section>
    </>
  );
}
