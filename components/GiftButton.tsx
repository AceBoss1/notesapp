"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { startCheckout } from "@/lib/checkout";
import { GIFT_MAX_KOBO, GIFT_MESSAGE_MAX, GIFT_MIN_KOBO } from "@/lib/boost-config";
import { formatNaira, PublisherSettings } from "@/lib/booking-time";
import { GIFT_SETTINGS, MOTIF_BLURB, enabledGifts, isGrand, needsVerified, senderVerified, verifiedRuleText, type AnimatedGift } from "@/lib/gift-catalogue";
import { WALLET_LIVE, nairaOf } from "@/lib/wallet";
import { giftSoundOn, setGiftSound } from "@/lib/gift-play";
import { useLivePricing } from "@/lib/useLivePricing";
import GiftArt, { GiftArtStyles } from "@/components/GiftArt";

// Gift button for a publisher's profile (no noteId) or a single post (noteId set), and, through liveId, a live. Hidden unless the
// publisher can actually be paid and hasn't switched gifts off. The sheet offers the animated gifts (lib/gift-catalogue.ts, priced in
// Admin → Pricing) or any amount, and pays from NotesApp Credit or through Paystack. Same commission and 7-day hold either way.
export default function GiftButton({
  username,
  publisherUid,
  noteId,
  liveId,
  toName,
  forTitle,
  label = "🎁 Gift",
  startOpen = false,
}: {
  username: string;
  publisherUid?: string;
  noteId?: string;
  liveId?: string;
  toName?: string;
  forTitle?: string;
  label?: string;
  startOpen?: boolean;
}) {
  useLivePricing();
  const [user, setUser] = useState<User | null | undefined>(undefined);
  // "off": publisher switched gifts off (hidden); "no-payout": not set up to be paid yet (shown disabled).
  const [ready, setReady] = useState<"loading" | "ready" | "no-payout" | "off">("loading");
  const [open, setOpen] = useState(startOpen);
  const [pick, setPick] = useState<string>("jollof"); // a gift id, or "other"
  const [custom, setCustom] = useState("");
  const [message, setMessage] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  const [wallet, setWallet] = useState<number | null>(null);
  const [payWith, setPayWith] = useState<"wallet" | "card">("card");
  const [sound, setSound] = useState(false);

  useEffect(() => onAuthStateChanged(auth, setUser), []);
  useEffect(() => setSound(giftSoundOn()), []);
  useEffect(() => {
    if (!publisherUid) return;
    getDoc(doc(db, "publisherSettings", publisherUid))
      .then((snap) => {
        const s = snap.data() as PublisherSettings | undefined;
        setReady(s?.gifts?.enabled === false ? "off" : s?.payoutReady ? "ready" : "no-payout");
      })
      .catch(() => setReady("no-payout"));
  }, [publisherUid]);
  // When the sheet opens: whether this sender may send the big gifts, and what's in their wallet.
  useEffect(() => {
    if (!open || !user) return;
    getDoc(doc(db, "users", user.uid)).then((s) => setVerified(senderVerified(s.data()))).catch(() => {});
    if (!WALLET_LIVE) return;
    user.getIdToken()
      .then((t) => fetch("/api/wallet?brief=1", { headers: { Authorization: `Bearer ${t}` } }))
      .then((r) => (r.ok ? r.json() : null))
      .then((w) => { if (w) { setWallet(w.creditKobo); setPayWith(w.creditKobo > 0 ? "wallet" : "card"); } })
      .catch(() => {});
  }, [open, user]);

  if (ready === "loading" || ready === "off" || user === undefined || user?.uid === publisherUid) return null;

  // Greyed out, with the reason behind an ℹ️ you can hover (computer) or tap (phone) instead of a line under the button.
  if (ready === "no-payout") {
    return (
      <span className="group relative inline-flex items-center gap-1">
        <button type="button" disabled aria-disabled="true" className="btn-ghost !px-4 !py-2 text-xs cursor-not-allowed opacity-50">
          {label}
        </button>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          onBlur={() => setOpen(false)}
          aria-label="Why can't I send a gift?"
          aria-expanded={open}
          className="flex h-6 w-6 items-center justify-center rounded-full text-sm leading-none text-slate hover:text-ink"
        >
          ℹ️
        </button>
        <span
          role="tooltip"
          className={`absolute left-0 top-full z-30 mt-1 w-56 sm:left-auto sm:right-0 rounded border border-rule bg-paper px-3 py-2 text-[11px] leading-snug text-slate shadow-lg ${open ? "block" : "hidden group-hover:block"}`}
        >
          This publisher hasn&apos;t set up payouts yet, so gifts can&apos;t reach them. Try again later.
        </span>
      </span>
    );
  }

  const gifts = enabledGifts();
  const chosen: AnimatedGift | undefined = gifts.find((g) => g.id === pick);
  const kobo = chosen ? chosen.priceKobo : Math.round(Number(custom) * 100) || 0;
  const locked = (g: AnimatedGift) => needsVerified(g) && !verified;
  const short = wallet !== null && kobo > wallet;
  const name = toName || `@${username}`;
  const first = (toName || username).split(" ")[0];

  async function send() {
    setError(null);
    if (!user) return setError("Sign in to send a gift.");
    if (chosen && locked(chosen)) return setError(`${chosen.name} is for verified senders: gifts ${verifiedRuleText()} need the ✔ badge.`);
    if (!chosen && !(kobo >= GIFT_MIN_KOBO && kobo <= GIFT_MAX_KOBO)) return setError(`Gifts must be between ${formatNaira(GIFT_MIN_KOBO)} and ${formatNaira(GIFT_MAX_KOBO)}.`);
    if (payWith === "wallet" && short) return setError("There isn't enough in your NotesApp Credit for this gift. Pay by card, or choose a smaller one.");
    setBusy(true);
    try {
      await startCheckout(
        user,
        { kind: "gift", username, amountNaira: kobo / 100, ...(chosen ? { giftId: chosen.id } : {}), noteId, liveId, message, anonymous },
        { amountKobo: kobo, payWith: WALLET_LIVE ? payWith : "card" },
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start payment.");
      setBusy(false);
    }
  }

  const tile = (on: boolean, off = false) =>
    `relative flex flex-col items-center overflow-hidden rounded-2xl border-2 px-1 pb-2 pt-1 text-center transition ${on ? "border-crimson bg-crimson/5 ring-4 ring-crimson/10" : "border-rule bg-card hover:border-crimson/40"} ${off ? "opacity-55" : ""}`;
  const radio = (on: boolean) => `mt-1 h-5 w-5 shrink-0 rounded-full ${on ? "border-[6px] border-crimson" : "border-2 border-slate/50"}`;

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-ghost !px-4 !py-2 text-xs">
        {label}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/60 sm:items-center sm:p-4" onClick={() => !busy && setOpen(false)}>
          <GiftArtStyles />
          <div role="dialog" aria-modal="true" aria-label="Send a gift" className="flex max-h-[94vh] w-full max-w-xl flex-col rounded-t-3xl bg-paper text-left shadow-xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-rule sm:hidden" />
            <div className="flex items-center justify-between border-b border-rule px-5 py-3">
              <p className="font-ui text-xl font-bold text-ink">Send a gift</p>
              <button onClick={() => setOpen(false)} disabled={busy} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full bg-card text-lg text-slate hover:text-ink">✕</button>
            </div>
            <div className="overflow-y-auto px-5 pb-5 pt-4">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#C8562B] font-ui text-sm font-bold text-paper">{(toName || username).split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}</span>
                <span className="min-w-0">
                  <span className="block truncate font-ui text-base font-bold text-ink">Gift {name}</span>
                  <span className="block truncate text-sm text-slate">{forTitle ? `for "${forTitle}"` : noteId ? "for this post" : liveId ? "during this live" : "for their work"}</span>
                </span>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {gifts.map((g) => (
                  <button key={g.id} type="button" onClick={() => setPick(g.id)} aria-pressed={pick === g.id} className={tile(pick === g.id, locked(g))} title={`${g.name}: ${MOTIF_BLURB[g.id]}`}>
                    <GiftArt id={g.id} size={56} motion={pick === g.id ? "loop" : "still"} />
                    <span className="mt-0.5 line-clamp-2 flex min-h-[2em] items-center font-ui text-[12px] font-semibold leading-tight text-ink">{g.name}</span>
                    <span className="font-display text-base leading-tight text-ink">{formatNaira(g.priceKobo)}</span>
                    {locked(g) && <span className="absolute right-1.5 top-1.5 rounded-full bg-ink px-1.5 text-[10px] font-semibold text-paper" title="Needs a verified account">✔ only</span>}
                  </button>
                ))}
                <button type="button" onClick={() => setPick("other")} aria-pressed={pick === "other"} className={`${tile(pick === "other")} justify-center`}>
                  <span className="font-display text-lg text-ink">Other</span>
                  <span className="text-[11px] text-slate">{formatNaira(GIFT_MIN_KOBO)} to {formatNaira(GIFT_MAX_KOBO)}</span>
                </button>
              </div>
              {pick === "other" && (
                <input type="number" inputMode="numeric" min={GIFT_MIN_KOBO / 100} max={GIFT_MAX_KOBO / 100} value={custom} onChange={(e) => setCustom(e.target.value)} aria-label="Amount in naira"
                  placeholder={`Amount in naira (${formatNaira(GIFT_MIN_KOBO)} – ${formatNaira(GIFT_MAX_KOBO)})`} className="mt-3 w-full rounded-xl border border-rule bg-card px-4 py-3 text-base outline-none focus:border-crimson" />
              )}
              {chosen && <p className="mt-2 text-xs text-slate"><b className="text-ink">{chosen.name}</b>: {MOTIF_BLURB[chosen.id]}. It plays full screen for {first} and everyone on their page{isGrand(chosen.priceKobo) && GIFT_SETTINGS.grand.announce ? ", and everyone on #NotesApp is told, with a link to watch" : ""}.{needsVerified(chosen) ? ` For verified senders: gifts ${verifiedRuleText()} need the ✔ badge.` : ""}</p>}

              <label className="mt-4 block font-ui text-sm font-semibold text-ink" htmlFor="gift-msg">Message (optional)</label>
              <input id="gift-msg" value={message} maxLength={GIFT_MESSAGE_MAX} onChange={(e) => setMessage(e.target.value)} placeholder="Say thank you" className="mt-1 w-full rounded-xl border border-rule bg-card px-4 py-3 text-base outline-none focus:border-crimson" />
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink">
                <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-crimson" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} /> Send anonymously</label>
                <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-crimson" checked={sound} onChange={(e) => { setSound(e.target.checked); setGiftSound(e.target.checked); }} /> Gift sounds on this device</label>
              </div>

              {WALLET_LIVE && (
                <>
                  <p className="mt-4 font-ui text-sm font-semibold text-ink">Pay with</p>
                  <button type="button" onClick={() => setPayWith("wallet")} className={`mt-2 flex w-full items-start gap-3 rounded-2xl border-2 p-3 text-left ${payWith === "wallet" ? "border-crimson" : "border-rule"}`}>
                    <span className={radio(payWith === "wallet")} />
                    <span><b className="block text-ink">NotesApp Credit</b><span className="text-sm text-slate">{wallet === null ? "Checking your balance…" : `${nairaOf(wallet)} available${short ? " (not enough for this gift)" : ""}`}</span></span>
                  </button>
                  <button type="button" onClick={() => setPayWith("card")} className={`mt-2 flex w-full items-start gap-3 rounded-2xl border-2 p-3 text-left ${payWith === "card" ? "border-crimson" : "border-rule"}`}>
                    <span className={radio(payWith === "card")} />
                    <span><b className="block text-ink">Card, bank transfer or USSD</b><span className="text-sm text-slate">Paid securely through Paystack</span></span>
                  </button>
                </>
              )}

              {error && <p className="mt-3 text-sm text-crimson" role="alert">{error}</p>}
              <button onClick={send} disabled={busy || kobo <= 0 || (!!chosen && locked(chosen))} className="mt-4 w-full rounded-full bg-crimson py-3.5 font-ui text-base font-semibold text-paper hover:bg-crimson-bright disabled:opacity-50">
                {busy ? "One moment…" : `🎁 Send ${chosen ? `${chosen.name}, ` : ""}${formatNaira(kobo)}`}
              </button>
              <p className="mt-3 text-xs text-slate">{first} gets it after a 7-day hold, less their plan&apos;s commission. Gifts are final unless a problem is reported.</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
