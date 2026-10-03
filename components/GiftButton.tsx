"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { startCheckout } from "@/lib/checkout";
import { GIFT_MAX_KOBO, GIFT_MESSAGE_MAX, GIFT_MIN_KOBO, GIFT_PRESETS_NAIRA } from "@/lib/boost-config";
import { formatNaira, PublisherSettings } from "@/lib/booking-time";

// Gift button for a publisher's profile (no noteId) or a single post
// (noteId set). Hidden unless the publisher can actually be paid and
// hasn't switched gifts off.
export default function GiftButton({
  username,
  publisherUid,
  noteId,
  label = "🎁 Gift",
}: {
  username: string;
  publisherUid?: string;
  noteId?: string;
  label?: string;
}) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  // "off": publisher switched gifts off (hidden); "no-payout": not set up to be paid yet (shown disabled).
  const [ready, setReady] = useState<"loading" | "ready" | "no-payout" | "off">("loading");
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState<number>(GIFT_PRESETS_NAIRA[1]);
  const [custom, setCustom] = useState("");
  const [message, setMessage] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => onAuthStateChanged(auth, setUser), []);
  useEffect(() => {
    if (!publisherUid) return;
    getDoc(doc(db, "publisherSettings", publisherUid))
      .then((snap) => {
        const s = snap.data() as PublisherSettings | undefined;
        setReady(s?.gifts?.enabled === false ? "off" : s?.payoutReady ? "ready" : "no-payout");
      })
      .catch(() => setReady("no-payout"));
  }, [publisherUid]);

  if (ready === "loading" || ready === "off" || user === undefined || user?.uid === publisherUid) return null;

  if (ready === "no-payout") {
    return (
      <span className="inline-flex flex-col items-start gap-1">
        <button type="button" disabled aria-disabled="true" className="btn-ghost !px-4 !py-2 text-xs cursor-not-allowed opacity-50">
          {label}
        </button>
        <span className="text-[11px] text-slate">This publisher hasn't set up payouts yet.</span>
      </span>
    );
  }

  const naira = custom ? Number(custom) : amount;

  async function send() {
    setError(null);
    if (!user) return setError("Sign in to send a gift.");
    if (!(naira * 100 >= GIFT_MIN_KOBO && naira * 100 <= GIFT_MAX_KOBO)) {
      return setError("Gifts must be between ₦200 and ₦500,000.");
    }
    setBusy(true);
    try {
      await startCheckout(user, { kind: "gift", username, amountNaira: naira, noteId, message, anonymous });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start payment.");
      setBusy(false);
    }
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-ghost !px-4 !py-2 text-xs">
        {label}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4" onClick={() => !busy && setOpen(false)}>
          <div className="w-full max-w-sm bg-paper p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <p className="font-display text-xl text-ink">Send a gift{noteId ? " for this post" : ` to @${username}`}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {GIFT_PRESETS_NAIRA.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => (setAmount(n), setCustom(""))}
                  className={`rounded-full border px-4 py-1.5 text-sm ${!custom && amount === n ? "border-crimson bg-crimson text-paper" : "border-rule text-ink"}`}
                >
                  {formatNaira(n * 100)}
                </button>
              ))}
            </div>
            <input
              type="number"
              min={200}
              max={500000}
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="Or enter an amount (₦200 – ₦500,000)"
              className="mt-3 w-full border border-rule bg-card px-3 py-2 text-sm outline-none focus:border-crimson"
            />
            <textarea
              value={message}
              maxLength={GIFT_MESSAGE_MAX}
              onChange={(e) => setMessage(e.target.value)}
              rows={2}
              placeholder="Add a message (optional)"
              className="mt-3 w-full border border-rule bg-card px-3 py-2 text-sm outline-none focus:border-crimson"
            />
            <label className="mt-3 flex items-center gap-2 text-xs text-slate">
              <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} />
              Send anonymously
            </label>
            {error && <p className="mt-3 text-xs text-crimson">{error}</p>}
            <div className="mt-5 flex gap-3">
              <button onClick={send} disabled={busy} className="btn-primary !px-5 !py-2 text-xs disabled:opacity-50">
                {busy ? "Redirecting…" : `Send ${formatNaira(Math.round(naira * 100) || 0)}`}
              </button>
              <button onClick={() => setOpen(false)} disabled={busy} className="text-xs text-slate underline">
                Cancel
              </button>
            </div>
            <p className="mt-3 text-[11px] text-slate">Paid securely through Paystack. Gifts are final unless a problem is reported to us.</p>
          </div>
        </div>
      )}
    </>
  );
}
