"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { AD_PACKAGES, AD_RULES } from "@/lib/ad-packages";
import { AD_FOOTER, AD_PLACEMENTS, AdPlacement } from "@/lib/ads";
import { startCheckout } from "@/lib/checkout";
import { uploadToR2 } from "@/lib/upload";
import { formatNaira } from "@/lib/booking-time";

const field = "mt-1 w-full border border-rule bg-card px-3 py-2 text-sm outline-none focus:border-crimson";

export default function NewCampaignPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [packageId, setPackageId] = useState(AD_PACKAGES[0].id);
  const [advertiserName, setAdvertiserName] = useState("");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [href, setHref] = useState("");
  const [image, setImage] = useState("");
  const [placements, setPlacements] = useState<AdPlacement[]>(["home", "journals", "trending"]);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => onAuthStateChanged(auth, (u) => (u ? setUser(u) : router.replace("/login"))), [router]);

  const pkg = AD_PACKAGES.find((p) => p.id === packageId)!;

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setBusy(true);
    setError("");
    try {
      setImage(await uploadToR2(file, "ad"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError("");
    if (!advertiserName.trim()) return setError("Add your business or brand name.");
    if (!title.trim()) return setError("Add a headline.");
    if (!/^https:\/\//i.test(href.trim())) return setError("The link must start with https://");
    if (!image) return setError("Upload a banner image.");
    if (placements.length === 0) return setError("Pick at least one placement.");
    if (!agreed) return setError("Please confirm you've read the ad rules.");
    setBusy(true);
    try {
      await startCheckout(user, {
        kind: "ad", packageId, advertiserName: advertiserName.trim(), title: title.trim(), text: text.trim(),
        image, href: href.trim(), placements, agreed,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start payment.");
      setBusy(false);
    }
  }

  if (!user) return <div className="px-6 py-24 text-center text-slate">Loading…</div>;
  return (
    <section className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <span className="eyebrow">Advertise</span>
      <h1 className="mt-3 font-display text-3xl text-ink">Run a banner on #NotesApp</h1>
      <p className="mt-2 text-sm text-slate">
        Pay once for a block of validated impressions (unique per visitor per ad per day). We review every ad before it goes live;
        if we can&apos;t run it you&apos;re refunded in full.{" "}
        <Link href="/advertise/campaigns" className="text-crimson underline">My campaigns</Link>
      </p>

      <form onSubmit={submit} className="mt-8 space-y-6">
        <fieldset>
          <legend className="font-ui text-sm font-bold text-ink">1. Package</legend>
          <div className="mt-2 grid gap-3 sm:grid-cols-3">
            {AD_PACKAGES.map((p) => (
              <label key={p.id} className={`card cursor-pointer p-4 ${p.id === packageId ? "!border-crimson" : ""}`}>
                <input type="radio" name="pkg" className="sr-only" checked={p.id === packageId} onChange={() => setPackageId(p.id)} />
                <p className="font-display text-lg text-ink">{p.name}</p>
                <p className="text-sm text-ink">{formatNaira(p.priceKobo)}</p>
                <p className="mt-1 text-xs text-slate">{p.impressions.toLocaleString()} impressions · up to {p.windowDays} days</p>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="font-ui text-sm font-bold text-ink">2. Your ad</legend>
          <label className="text-xs text-slate sm:col-span-2">Business / brand name
            <input value={advertiserName} onChange={(e) => setAdvertiserName(e.target.value)} className={field} maxLength={80} />
          </label>
          <label className="text-xs text-slate sm:col-span-2">Headline
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={field} maxLength={90} />
          </label>
          <label className="text-xs text-slate sm:col-span-2">Short text (optional)
            <input value={text} onChange={(e) => setText(e.target.value)} className={field} maxLength={180} />
          </label>
          <label className="text-xs text-slate sm:col-span-2">Where it links (https://…)
            <input value={href} onChange={(e) => setHref(e.target.value)} className={field} />
          </label>
          <div className="text-xs text-slate sm:col-span-2">Banner image
            <div className="mt-1 flex items-center gap-3">
              {image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={image} alt="" className="h-14 w-24 object-cover" />
              )}
              <input type="file" accept="image/*" onChange={upload} />
            </div>
          </div>
        </fieldset>

        <fieldset>
          <legend className="font-ui text-sm font-bold text-ink">3. Placements</legend>
          <div className="mt-2 flex flex-wrap gap-4 text-sm">
            {(Object.keys(AD_PLACEMENTS) as AdPlacement[]).map((p) => (
              <label key={p} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={placements.includes(p)}
                  onChange={() => setPlacements((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]))}
                />
                {AD_PLACEMENTS[p].label}
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate">Shown labelled “{AD_FOOTER.notesapp}”.</p>
        </fieldset>

        <div className="card p-4 text-sm">
          <p className="font-ui font-bold text-ink">What we don&apos;t run</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate">{AD_RULES.map((r) => <li key={r}>{r}</li>)}</ul>
          <label className="mt-3 flex items-start gap-2 text-xs text-ink">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5" />
            <span>I&apos;ve read these rules and <Link href="/terms" className="text-crimson underline">Terms 5e</Link>; my ad follows them.</span>
          </label>
        </div>

        {error && <p className="text-sm text-crimson">{error}</p>}
        <button disabled={busy} className="btn-primary">{busy ? "Please wait…" : `Pay ${formatNaira(pkg.priceKobo)}`}</button>
      </form>
    </section>
  );
}
