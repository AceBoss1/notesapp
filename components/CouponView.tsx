"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/moments-client";
import { useMember } from "@/lib/member-client";
import { TARGET_LABEL, naira, type PublicCoupon } from "@/lib/discounts";

// One coupon's page: the card, Copy, Save to my coupons, Share and Shop now. The card's picture is /api/coupons/card.
export default function CouponView({ seller, code }: { seller: string; code: string }) {
  const { user } = useMember();
  const [c, setC] = useState<PublicCoupon | null | undefined>(undefined);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState("");
  const card = `/api/coupons/card?seller=${encodeURIComponent(seller)}&code=${encodeURIComponent(code)}`;

  useEffect(() => {
    setUrl(window.location.href);
    fetch(`/api/coupons?seller=${encodeURIComponent(seller)}&code=${encodeURIComponent(code)}`).then((r) => r.json()).then((r) => setC(r.coupon ?? null)).catch(() => setC(null));
  }, [seller, code]);

  async function save() {
    setBusy(true); setNote("");
    try { await api("/api/coupons", { body: { action: "save", seller, code } }); setNote("Saved to My coupons. Nana applies it at checkout when it's your best coupon."); }
    catch (e) { setNote(e instanceof Error ? e.message : "Couldn't save it."); }
    finally { setBusy(false); }
  }
  async function copy(text: string, done: string) {
    try { await navigator.clipboard.writeText(text); setNote(done); } catch { window.prompt("Copy", text); }
  }

  return (
    <section className="mx-auto max-w-2xl px-6 py-10">
      <img src={card} alt={`Coupon ${code} from @${seller}`} className="w-full rounded-2xl shadow-sm" width={1200} height={630} />
      {c === undefined ? <p className="mt-6 text-sm text-slate">Loading…</p> : c === null ? (
        <p className="mt-6 text-sm text-slate">This coupon has ended or isn&apos;t available. <Link href={`/u/${seller}/store`} className="text-crimson underline">See @{seller}&apos;s shop</Link></p>
      ) : (
        <>
          <h1 className="mt-6 font-display text-3xl text-ink">{c.label} at @{seller}&apos;s shop</h1>
          <p className="mt-2 text-sm text-slate">
            On {c.targets.map((t) => TARGET_LABEL[t].toLowerCase()).join(", ")}{c.itemIds.length ? ` (${c.itemIds.length} selected item${c.itemIds.length > 1 ? "s" : ""})` : ""}
            {c.minOrderKobo ? ` · orders of ${naira(c.minOrderKobo)} or more` : ""}{c.firstOrderOnly ? " · first order only" : ""}
            {c.endsAt ? ` · ends ${new Date(c.endsAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}` : ""}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href={`/u/${seller}/store`} className="btn-primary !px-5 !py-2.5 text-sm">Shop now</Link>
            {user ? (
              <button type="button" onClick={save} disabled={busy} className="btn-ghost !px-5 !py-2.5 text-sm">{busy ? "Saving…" : "Save to my coupons"}</button>
            ) : user === null ? (
              <Link href={`/login?next=${encodeURIComponent(`/coupon/${seller}/${code}`)}`} className="btn-ghost !px-5 !py-2.5 text-sm">Sign in to save it</Link>
            ) : null}
            <button type="button" onClick={() => copy(code, `Copied ${code}. Type it under "Have a discount code?" at checkout.`)} className="btn-ghost !px-5 !py-2.5 text-sm">Copy code</button>
          </div>
          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            <a href={`https://wa.me/?text=${encodeURIComponent(`${c.label} at @${seller}'s shop on #NotesApp with ${code}: ${url}`)}`} target="_blank" rel="noopener" className="text-crimson underline">Share on WhatsApp</a>
            <button type="button" onClick={() => copy(url, "Link copied.")} className="text-crimson underline">Copy link</button>
            <a href={card} download={`${code}.png`} className="text-crimson underline">Download the card</a>
          </div>
        </>
      )}
      {note && <p className="mt-4 rounded-lg bg-moss/10 px-3 py-2 text-sm text-moss" role="status">{note}</p>}
      <p className="mt-10 text-xs text-slate">Your saved coupons: <Link href="/profile/coupons" className="text-crimson underline">My coupons</Link>.</p>
    </section>
  );
}
