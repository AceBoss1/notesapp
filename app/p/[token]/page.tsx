"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { HOLDER_LABEL, HolderType } from "@/lib/orders";

type Info = {
  parcelId: string;
  itemTitle: string;
  destination: string;
  parcelStatus: string;
  entry: { id: string; holderType: HolderType; holderName: string; location: string; status: "confirmed" | "pending" };
  isLatest: boolean;
};
const field = "mt-1 w-full border border-rule bg-card px-3 py-2 text-sm outline-none focus:border-crimson";

// No-login page for whoever is carrying a parcel. Works until the next holder confirms.
export default function HolderPage() {
  const { token } = useParams<{ token: string }>();
  const [info, setInfo] = useState<Info | null>(null);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [location, setLocation] = useState("");
  const [next, setNext] = useState({ holderType: "bike" as HolderType, holderName: "", holderPhone: "", location: "", consent: false });
  const [nextUrl, setNextUrl] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/track/holder?token=${encodeURIComponent(token)}`);
    const j = await res.json();
    if (!res.ok) {
      setInfo(null);
      return setError(j.error || "This link isn't valid.");
    }
    setInfo(j);
    setLocation(j.entry.location);
  }, [token]);
  useEffect(() => {
    load();
  }, [load]);

  async function act(body: Record<string, unknown>, ok: string) {
    setBusy(true);
    setError("");
    setMsg("");
    try {
      const res = await fetch("/api/track/holder", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, ...body }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Failed");
      if (j.nextUrl) setNextUrl(j.nextUrl);
      setMsg(ok);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (!info) return <div className="mx-auto max-w-md px-4 py-24 text-center text-slate">{error || "Loading…"}</div>;
  const e = info.entry;
  return (
    <section className="mx-auto max-w-md px-4 py-12">
      <span className="eyebrow">Parcel {info.parcelId}</span>
      <h1 className="mt-3 font-display text-2xl text-ink">{info.itemTitle}</h1>
      <p className="mt-1 text-sm text-slate">Going to {info.destination} · you: {HOLDER_LABEL[e.holderType]} {e.holderName}</p>
      {error && <p className="mt-4 text-sm text-crimson">{error}</p>}
      {msg && <p className="mt-4 text-sm text-ink">{msg}</p>}

      {e.status === "pending" ? (
        <div className="card mt-6 p-5 text-sm">
          <p className="text-ink">Someone handed this parcel to you. When you actually have it in your hands, confirm.</p>
          <button disabled={busy} onClick={() => act({ action: "confirm" }, "Thanks — you're now the holder. Update the location, hand it on or mark it delivered from this page.")} className="btn-primary mt-3 !px-4 !py-2 text-xs">I have the parcel</button>
        </div>
      ) : !info.isLatest ? (
        <p className="card mt-6 p-5 text-sm text-slate">The parcel has moved on from you — this link no longer does anything. Thank you!</p>
      ) : (
        <div className="mt-6 space-y-5">
          <div className="card p-5 text-sm">
            <p className="font-ui font-bold text-ink">Where is it now?</p>
            <input value={location} onChange={(ev) => setLocation(ev.target.value)} className={field} />
            <button disabled={busy || !location.trim()} onClick={() => act({ action: "update_location", location }, "Location updated.")} className="btn-primary mt-2 !px-4 !py-2 text-xs">Update location</button>
          </div>
          <div className="card p-5 text-sm">
            <p className="font-ui font-bold text-ink">Handing it to someone else?</p>
            <div className="mt-2 grid gap-2">
              <label className="text-xs text-slate">Who
                <select value={next.holderType} onChange={(ev) => setNext({ ...next, holderType: ev.target.value as HolderType })} className={field}>
                  {(["bike", "bus", "park", "seller"] as HolderType[]).map((t) => <option key={t} value={t}>{HOLDER_LABEL[t]}</option>)}
                </select>
              </label>
              <label className="text-xs text-slate">Their name<input value={next.holderName} onChange={(ev) => setNext({ ...next, holderName: ev.target.value })} className={field} /></label>
              <label className="text-xs text-slate">Their phone<input value={next.holderPhone} onChange={(ev) => setNext({ ...next, holderPhone: ev.target.value })} className={field} placeholder="08012345678" /></label>
              <label className="text-xs text-slate">Where you&apos;re handing it over<input value={next.location} onChange={(ev) => setNext({ ...next, location: ev.target.value })} className={field} /></label>
              <label className="flex items-start gap-2 text-xs text-slate">
                <input type="checkbox" checked={next.consent} onChange={(ev) => setNext({ ...next, consent: ev.target.checked })} className="mt-0.5" />
                <span>They agree to their phone number being shown to the buyer.</span>
              </label>
            </div>
            <button disabled={busy} onClick={() => act({ action: "pass_on", ...next }, "Recorded. Send them the link below — your own link stops working once they confirm.")} className="btn-primary mt-3 !px-4 !py-2 text-xs">Hand it on</button>
            {nextUrl && (
              <p className="mt-3 break-all text-xs text-ink">
                Send this to {next.holderName || "them"}: <span className="font-mono">{nextUrl}</span>{" "}
                <button onClick={() => navigator.clipboard?.writeText(nextUrl)} className="font-semibold text-crimson">Copy</button>
              </p>
            )}
          </div>
          <div className="card p-5 text-sm">
            <p className="font-ui font-bold text-ink">Delivered to the buyer?</p>
            <button disabled={busy} onClick={() => confirm("Mark this parcel as delivered to the buyer?") && act({ action: "delivered" }, "Marked delivered. Thank you!")} className="btn-primary mt-2 !px-4 !py-2 text-xs">Mark delivered</button>
          </div>
        </div>
      )}
    </section>
  );
}
