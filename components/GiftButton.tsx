"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { startCheckout } from "@/lib/checkout";
import { GIFT_MAX_KOBO, GIFT_MESSAGE_MAX, GIFT_MIN_KOBO } from "@/lib/boost-config";
import { formatNaira } from "@/lib/booking-time";
import { GIFT_SETTINGS, MOTIF_BLURB, NO_BONUS_TEXT, enabledGifts, giftPointsFor, isGrand, needsVerified, quantityCap, senderVerified, verifiedRuleText, type AnimatedGift, type GiftContext, type GiftToKind } from "@/lib/gift-catalogue";
import { WALLET_LIVE, nairaOf } from "@/lib/wallet";
import { giftSoundOn, setGiftSound } from "@/lib/gift-play";
import { useLivePricing } from "@/lib/useLivePricing";
import GiftArt, { GiftArtStyles } from "@/components/GiftArt";

// Gift button for a publisher's profile (no noteId) or a single post (noteId set), and, through liveId, a live. Since v0.140.0 it also
// gifts anyone: a speaker on stage, the author of a comment or review, a Media post's creator or a replay's host (toKind, context;
// components/gifts/PersonActions.tsx opens it from the Gift · Block · Report menu with sheetOnly). Whether this viewer may gift them is
// asked of the server (GET /api/gifts/can): hidden when gifts are off or it's yourself; shown switched off, with the reason, when the
// receiver hasn't set up payouts, is in teen mode and doesn't follow the viewer back, or blocked them. The sheet offers the animated
// gifts (lib/gift-catalogue.ts, priced in Admin → Pricing) or any amount; tapping a small (premium) gift twice opens "How many?".
// It pays from the member's own NotesApp Credit (never Bonus Credits) or through Paystack. Same commission and 7-day review either way.
type Ready = "loading" | "ready" | "no-payout" | "off" | "teen" | "blocked" | "self" | "missing";
export default function GiftButton({
  username: givenUsername,
  publisherUid,
  noteId,
  liveId,
  toName,
  forTitle,
  label = "🎁 Gift",
  startOpen = false,
  toKind,
  context,
  mediaId,
  replayId,
  sheetOnly = false,
  onClose,
}: {
  username?: string;
  publisherUid?: string;
  noteId?: string;
  liveId?: string;
  toName?: string;
  forTitle?: string;
  label?: string;
  startOpen?: boolean;
  toKind?: GiftToKind;
  context?: GiftContext;
  mediaId?: string;
  replayId?: string;
  sheetOnly?: boolean; // no button: the sheet opens at once and onClose is called when it shuts (PersonActions)
  onClose?: () => void;
}) {
  useLivePricing();
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [ready, setReady] = useState<Ready>("loading");
  const [why, setWhy] = useState("");
  const [username, setUsername] = useState(givenUsername ?? "");
  const [openState, setOpenState] = useState(startOpen || sheetOnly);
  const open = openState;
  const setOpen = (v: boolean | ((o: boolean) => boolean)) => setOpenState((o) => { const n = typeof v === "function" ? v(o) : v; if (!n && o && sheetOnly) setTimeout(() => onClose?.(), 0); return n; });
  const [qty, setQty] = useState(1);
  const [askQty, setAskQty] = useState(false);
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
  // May this viewer gift this member? The server knows payouts, gifts switched off, teen mode (mutual followers only) and blocks.
  useEffect(() => {
    if (user === undefined || (!publisherUid && !givenUsername)) return;
    let gone = false;
    (async () => {
      const qs = publisherUid ? `uid=${encodeURIComponent(publisherUid)}` : `username=${encodeURIComponent(givenUsername!)}`;
      const headers: Record<string, string> = user ? { Authorization: `Bearer ${await user.getIdToken()}` } : {};
      const r = await fetch(`/api/gifts/can?${qs}`, { headers }).then((x) => x.json()).catch(() => null);
      if (gone) return;
      if (!r) { setReady("no-payout"); return; }
      if (r.username) setUsername(String(r.username));
      setWhy(String(r.message ?? ""));
      // Signed out, a teen's gift action just asks to sign in: the server only knows "teen" until it knows who is asking.
      setReady(r.ok ? "ready" : !user && r.reason === "teen" ? "ready" : (r.reason as Ready));
    })();
    return () => { gone = true; };
  }, [publisherUid, givenUsername, user]);
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

  if (ready === "loading" || ready === "off" || ready === "self" || ready === "missing" || user === undefined || user?.uid === publisherUid) {
    if (sheetOnly && (ready === "off" || ready === "self" || ready === "missing")) setTimeout(() => onClose?.(), 0);
    return null;
  }

  // Greyed out, with the reason behind an ℹ️ you can hover (computer) or tap (phone) instead of a line under the button. From the
  // person menu (sheetOnly) the reason shows as a small card instead.
  if (ready === "no-payout" || ready === "teen" || ready === "blocked") {
    const reason = why || "This member hasn't set up payouts yet, so gifts can't reach them. Try again later.";
    if (sheetOnly) {
      return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 sm:items-center sm:p-4" onClick={() => setOpen(false)}>
          <div role="dialog" aria-modal="true" aria-label="Gifts are off" className="w-full max-w-sm rounded-t-3xl bg-paper p-5 text-left shadow-xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <p className="font-ui text-base font-bold text-ink">🎁 Gift switched off</p>
            <p className="mt-2 text-sm text-slate">{reason}</p>
            <button type="button" onClick={() => setOpen(false)} className="mt-4 w-full rounded-full border border-rule py-2.5 font-ui text-sm font-semibold text-ink">OK</button>
          </div>
        </div>
      );
    }
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
          {reason}
        </span>
      </span>
    );
  }

  const gifts = enabledGifts();
  const chosen: AnimatedGift | undefined = gifts.find((g) => g.id === pick);
  const cap = chosen ? quantityCap(chosen, GIFT_MAX_KOBO, verified) : 1;
  const n = chosen ? Math.max(1, Math.min(cap, Math.floor(qty) || 1)) : 1;
  const kobo = chosen ? chosen.priceKobo * n : Math.round(Number(custom) * 100) || 0;
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
        {
          kind: "gift", username, amountNaira: kobo / 100, ...(chosen ? { giftId: chosen.id, ...(n > 1 ? { quantity: n } : {}) } : {}), noteId, liveId, message, anonymous,
          ...(toKind ? { toKind } : {}), ...(context ? { context } : {}), ...(mediaId ? { mediaId } : {}), ...(replayId ? { replayId } : {}),
        },
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

  // Tapping a small (premium) gift that is already picked, or double-tapping it, opens "How many?"; VIP gifts go one at a time.
  const tap = (g: AnimatedGift) => {
    if (pick === g.id && !isGrand(g.priceKobo) && !locked(g)) { setAskQty(true); return; }
    setPick(g.id); setQty(1); setAskQty(false);
  };

  return (
    <>
      {!sheetOnly && (
        <button onClick={() => setOpen(true)} className="btn-ghost !px-4 !py-2 text-xs">
          {label}
        </button>
      )}
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
                  <span className="block truncate text-sm text-slate">{forTitle ? `for "${forTitle}"` : context === "comment" ? "for their comment" : context === "review" ? "for their review" : context === "media" ? "for this Media post" : context === "replay" ? "for this replay" : toKind === "speaker" ? "on stage in this live" : noteId ? "for this post" : liveId ? "during this live" : "for their work"}</span>
                </span>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {gifts.map((g) => (
                  <button key={g.id} type="button" onClick={() => tap(g)} onDoubleClick={() => { if (!isGrand(g.priceKobo) && !locked(g)) { setPick(g.id); setAskQty(true); } }} aria-pressed={pick === g.id} data-gift-tile={g.id} className={tile(pick === g.id, locked(g))} title={`${g.name}: ${MOTIF_BLURB[g.id]}`}>
                    <GiftArt id={g.id} size={56} motion={pick === g.id ? "loop" : "still"} />
                    <span className="mt-0.5 line-clamp-2 flex min-h-[2em] items-center font-ui text-[12px] font-semibold leading-tight text-ink">{g.name}</span>
                    <span className="font-display text-base leading-tight text-ink">{formatNaira(g.priceKobo)}</span>
                    {locked(g) && <span className="absolute right-1.5 top-1.5 rounded-full bg-ink px-1.5 text-[10px] font-semibold text-paper" title="Needs a verified account">✔ only</span>}
                  </button>
                ))}
                <button type="button" onClick={() => { setPick("other"); setQty(1); setAskQty(false); }} aria-pressed={pick === "other"} className={`${tile(pick === "other")} justify-center`}>
                  <span className="font-display text-lg text-ink">Other</span>
                  <span className="text-[11px] text-slate">{formatNaira(GIFT_MIN_KOBO)} to {formatNaira(GIFT_MAX_KOBO)}</span>
                </button>
              </div>
              {pick === "other" && (
                <input type="number" inputMode="numeric" min={GIFT_MIN_KOBO / 100} max={GIFT_MAX_KOBO / 100} value={custom} onChange={(e) => setCustom(e.target.value)} aria-label="Amount in naira"
                  placeholder={`Amount in naira (${formatNaira(GIFT_MIN_KOBO)} – ${formatNaira(GIFT_MAX_KOBO)})`} className="mt-3 w-full rounded-xl border border-rule bg-card px-4 py-3 text-base outline-none focus:border-crimson" />
              )}
              {chosen && askQty && (
                <div className="mt-3 rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200" data-quantity-box>
                  <p className="font-ui text-sm font-bold text-ink">How many {chosen.name}{chosen.name.endsWith("s") ? "" : "s"}? <span className="font-normal text-slate">(tapped twice)</span></p>
                  <div className="mt-2 flex items-center gap-2">
                    <input type="number" inputMode="numeric" min={1} max={cap} value={qty} onChange={(e) => setQty(Number(e.target.value))} aria-label={`How many, 1 to ${cap}`} className="w-24 rounded-xl border border-rule bg-card px-3 py-2 text-base outline-none focus:border-crimson" />
                    <span className="text-xs text-slate">1 to {cap}</span>
                  </div>
                  <p className="mt-2 text-xs text-slate">Plays as ×{n}. +{giftPointsFor(kobo).toLocaleString("en-NG")} gift points. {NO_BONUS_TEXT}</p>
                </div>
              )}
              {chosen && !askQty && !isGrand(chosen.priceKobo) && !locked(chosen) && <p className="mt-2 text-[11px] text-slate">Tap {chosen.name} again to send more than one.</p>}
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
                  <p className="text-xs text-slate">{NO_BONUS_TEXT}</p>
                  <button type="button" onClick={() => setPayWith("wallet")} className={`mt-2 flex w-full items-start gap-3 rounded-2xl border-2 p-3 text-left ${payWith === "wallet" ? "border-crimson" : "border-rule"}`}>
                    <span className={radio(payWith === "wallet")} />
                    <span><b className="block text-ink">NotesApp Credit <span className="font-normal text-slate">(not Bonus Credits)</span></b><span className="text-sm text-slate">{wallet === null ? "Checking your balance…" : `${nairaOf(wallet)} available${short ? " (not enough for this gift)" : ""}`}</span></span>
                  </button>
                  <button type="button" onClick={() => setPayWith("card")} className={`mt-2 flex w-full items-start gap-3 rounded-2xl border-2 p-3 text-left ${payWith === "card" ? "border-crimson" : "border-rule"}`}>
                    <span className={radio(payWith === "card")} />
                    <span><b className="block text-ink">Card, bank transfer or USSD</b><span className="text-sm text-slate">Paid securely through Paystack</span></span>
                  </button>
                </>
              )}

              {error && <p className="mt-3 text-sm text-crimson" role="alert">{error}</p>}
              <button onClick={send} disabled={busy || kobo <= 0 || (!!chosen && locked(chosen))} className="mt-4 w-full rounded-full bg-crimson py-3.5 font-ui text-base font-semibold text-paper hover:bg-crimson-bright disabled:opacity-50">
                {busy ? "One moment…" : `🎁 Send ${chosen ? `${n > 1 ? `${n} × ` : ""}${chosen.name}, ` : ""}${formatNaira(kobo)}`}
              </button>
              <p className="mt-3 text-xs text-slate">{first} can withdraw it after a 7-day review, less their plan&apos;s commission. Gifts are final unless a problem is reported.</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
