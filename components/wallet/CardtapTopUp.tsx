"use client";

import { useEffect, useRef, useState } from "react";
import type { User } from "firebase/auth";
import QRCode from "qrcode";
import { nairaOf } from "@/lib/wallet";
import { CARDTAP_APP_URL, CARDTAP_WAIT_MINUTES, cardtapQuote } from "@/lib/cardtap-topup";

// The wallet page's "Top up with CardTap" (lib/cardtap-topup-server.ts). Shows Paylony's fee before you start (or that we're paying
// it, during the launch offer), then the code for the CardTap app, as text to copy and as a QR to scan, and waits for the tap.
type Started = { reference: string; initiationRef: string; instruction: string; payKobo: number; feeKobo: number; waived: boolean; bonusKobo: number; topupKobo: number };

export default function CardtapTopUp({ user, naira, ok, onPaid }: { user: User; naira: number; ok: boolean; onPaid: () => void }) {
  const [offer, setOffer] = useState<{ ready: boolean; feeWaived: boolean } | null>(null);
  const [started, setStarted] = useState<Started | null>(null);
  const [state, setState] = useState<"idle" | "starting" | "waiting" | "paid" | "failed" | "expired">("idle");
  const [error, setError] = useState<string | null>(null);
  const [qr, setQr] = useState("");
  const [copied, setCopied] = useState(false);
  const since = useRef(0);
  const auth = async () => ({ Authorization: `Bearer ${await user.getIdToken()}` });

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/wallet/cardtap", { headers: await auth(), cache: "no-store" }).catch(() => null);
      if (r?.ok) setOffer(await r.json());
    })();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Back from the CardTap app (Paylony's redirect, ?cardtap=<reference>): check that payment once and say how it went.
  const [back, setBack] = useState<string | null>(null);
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("cardtap");
    if (!ref || !/^[A-Za-z0-9_-]{6,80}$/.test(ref)) return;
    setBack("Checking your CardTap payment…");
    (async () => {
      const r = await fetch(`/api/wallet/cardtap?ref=${encodeURIComponent(ref)}`, { headers: await auth(), cache: "no-store" }).catch(() => null);
      const j = r?.ok ? await r.json() : null;
      if (j?.status === "paid") { setBack(`✓ ${nairaOf(j.topupKobo)} from CardTap is in your wallet${j.bonusKobo ? `, plus 🎁 ${nairaOf(j.bonusKobo)} in Bonus Credits` : ""}.`); onPaid(); }
      else if (j?.status === "failed") setBack("That CardTap payment didn't go through, so nothing was taken for it here.");
      else setBack("CardTap hasn't told us about that payment yet. If you paid, it's added as soon as it does.");
    })();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Waiting for the tap: ask every 4 seconds, for up to CARDTAP_WAIT_MINUTES.
  useEffect(() => {
    if (state !== "waiting" || !started) return;
    const t = setInterval(async () => {
      if (Date.now() - since.current > CARDTAP_WAIT_MINUTES * 60_000) { setState("expired"); return; }
      const r = await fetch(`/api/wallet/cardtap?ref=${encodeURIComponent(started.reference)}`, { headers: await auth(), cache: "no-store" }).catch(() => null);
      if (!r?.ok) return;
      const j = await r.json();
      if (j.status === "paid") { setState("paid"); onPaid(); }
      else if (j.status === "failed") setState("failed");
    }, 4000);
    return () => clearInterval(t);
  }, [state, started]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!offer?.ready) return back ? <p className="mt-4 rounded-xl bg-[#eff4ff] px-3 py-2 text-sm text-ink" aria-live="polite">{back}</p> : null;
  const q = cardtapQuote(Math.round(naira * 100), offer.feeWaived);

  async function start() {
    if (!ok) return setError("Top up a whole amount from ₦1,000 to ₦500,000.");
    setState("starting"); setError(null); setCopied(false);
    try {
      const r = await fetch("/api/wallet/cardtap", { method: "POST", headers: { "Content-Type": "application/json", ...(await auth()) }, body: JSON.stringify({ amountNaira: naira }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Couldn't start CardTap.");
      setStarted(j); since.current = Date.now(); setState("waiting");
      setQr(await QRCode.toDataURL(String(j.initiationRef), { margin: 1, width: 220, color: { dark: "#1A1210", light: "#ffffff" } }).catch(() => ""));
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't start CardTap."); setState("idle"); }
  }
  async function copy() {
    if (!started) return;
    try { await navigator.clipboard.writeText(started.initiationRef); setCopied(true); } catch { /* the code is on screen to type */ }
  }

  if (started && state !== "idle" && state !== "starting") {
    return (
      <div className="mt-4 rounded-2xl border-2 border-[#1d4ed8]/30 bg-[#eff4ff] p-4" aria-live="polite">
        {state === "paid" ? (
          <>
            <p className="font-ui text-base font-bold text-green-800">✓ Paid with CardTap</p>
            <p className="mt-1 text-sm text-ink">{nairaOf(started.topupKobo)} is in your wallet{started.bonusKobo ? `, plus 🎁 ${nairaOf(started.bonusKobo)} in Bonus Credits` : ""}.</p>
            <button type="button" onClick={() => { setStarted(null); setState("idle"); }} className="mt-3 text-sm font-semibold text-crimson underline">Top up again</button>
          </>
        ) : (
          <>
            <p className="font-ui text-sm font-bold text-ink">Pay {nairaOf(started.payKobo)} in the CardTap app</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-ink">
              <li>Open the CardTap app (<a href={CARDTAP_APP_URL} target="_blank" rel="noopener noreferrer" className="text-crimson underline">get it on Google Play</a>).</li>
              <li>Paste this code, or scan the QR with it.</li>
              <li>Tap your card on the phone and enter your PIN.</li>
            </ol>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span className="rounded-xl bg-white px-3 py-2 font-mono text-lg font-bold tracking-wider text-ink">{started.initiationRef}</span>
              <button type="button" onClick={copy} className="rounded-full border border-rule bg-white px-4 py-2 text-xs font-bold text-ink">{copied ? "Copied" : "Copy code"}</button>
            </div>
            {qr && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qr} alt={`QR code for ${started.initiationRef}`} width={150} height={150} className="mt-3 rounded-xl border border-rule bg-white p-1" />
            )}
            {started.instruction && <p className="mt-2 text-xs text-slate">{started.instruction}</p>}
            {state === "waiting" && <p className="mt-3 flex items-center gap-2 text-sm text-slate"><span className="h-2 w-2 animate-pulse rounded-full bg-[#1d4ed8]" />Waiting for your tap… this page updates by itself.</p>}
            {state === "failed" && <p className="mt-3 text-sm text-crimson" role="alert">The payment didn&apos;t go through, so nothing was taken for it here. <button type="button" onClick={start} className="font-semibold underline">Try again</button></p>}
            {state === "expired" && <p className="mt-3 text-sm text-crimson" role="alert">We didn&apos;t hear from CardTap in {CARDTAP_WAIT_MINUTES} minutes. If you paid, it&apos;ll still be added when CardTap tells us; otherwise <button type="button" onClick={start} className="font-semibold underline">get a new code</button>.</p>}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="mt-4 border-t border-rule pt-4">
      {back && <p className="mb-3 rounded-xl bg-[#eff4ff] px-3 py-2 text-sm text-ink" aria-live="polite">{back}</p>}
      <button type="button" onClick={start} disabled={state === "starting" || !ok} className="w-full rounded-full bg-[#1d4ed8] py-3 font-ui text-sm font-bold text-white hover:bg-[#1e40af] disabled:opacity-50">
        {state === "starting" ? "Getting your CardTap code…" : `Tap to pay ${ok ? nairaOf(q.payKobo) : ""} with CardTap`}
      </button>
      <p className="mt-2 text-center text-[11px] text-slate">
        {!ok ? "Paylony CardTap: tap your card on your phone." : q.waived ? <>No fee: we&apos;re paying CardTap&apos;s {nairaOf(q.feeKobo)} for you during the launch.</> : <>Includes CardTap&apos;s fee of {nairaOf(q.feeKobo)} (1%, never more than ₦1,000), at cost.</>}
      </p>
      {error && <p className="mt-2 text-xs text-crimson" role="alert">{error}</p>}
    </div>
  );
}
