"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useMember } from "@/lib/member-client";
import { api } from "@/lib/moments-client";
import { uploadToR2 } from "@/lib/upload";
import { faceFor, type Academy } from "@/lib/certificates";
import Certificate from "./Certificate";

type Form = { name: string; subtext: string; website: string; logoUrl: string; signerName: string; signerTitle: string; signatureUrl: string; margin: string; accName: string; accLogoUrl: string; accProof: string };
const EMPTY: Form = { name: "", subtext: "", website: "", logoUrl: "", signerName: "", signerTitle: "", signatureUrl: "", margin: "0", accName: "", accLogoUrl: "", accProof: "" };
const naira = (kobo: number) => `₦${Math.round(kobo / 100).toLocaleString("en-NG")}`;
const field = "mt-1 w-full rounded-xl border border-rule bg-card px-3.5 py-2.5 text-sm text-ink outline-none focus:border-crimson";
const label = "block text-sm font-semibold text-ink";

// A logo as PNG (up to 1200 px wide, transparency kept): the certificate picture (lib/certificate-image.tsx) can't read WebP.
async function asPng(file: File): Promise<File> {
  if (file.type === "image/png" || file.type === "image/jpeg") return file;
  const img = await createImageBitmap(file);
  const scale = Math.min(1, 1200 / img.width);
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  const blob: Blob = await new Promise((ok, no) => c.toBlob((b) => (b ? ok(b) : no(new Error("Couldn't read that picture."))), "image/png"));
  return new File([blob], "logo.png", { type: "image/png" });
}

// A photo of a signature on white paper → the same signature on transparent: near-white goes clear, light grey fades out.
async function whiten(file: File): Promise<File> {
  const img = await createImageBitmap(file);
  const scale = Math.min(1, 1200 / img.width);
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
  const g = c.getContext("2d")!;
  g.drawImage(img, 0, 0, c.width, c.height);
  const d = g.getImageData(0, 0, c.width, c.height);
  for (let i = 0; i < d.data.length; i += 4) {
    const light = Math.min(d.data[i], d.data[i + 1], d.data[i + 2]);
    d.data[i + 3] = light >= 205 ? 0 : light >= 160 ? Math.round(((205 - light) / 45) * d.data[i + 3]) : d.data[i + 3];
  }
  g.putImageData(d, 0, 0);
  const blob: Blob = await new Promise((ok, no) => c.toBlob((b) => (b ? ok(b) : no(new Error("Couldn't read that picture."))), "image/png"));
  return new File([blob], "signature.png", { type: "image/png" });
}

function ImagePick({ value, onPick, busy, hint }: { value: string; onPick: (f: File) => void; busy: boolean; hint: string }) {
  return (
    <div className="mt-1 flex items-center gap-3 rounded-xl border border-dashed border-rule bg-paper/60 p-3">
      {value ? <img src={value} alt="" className="h-12 max-w-[9rem] object-contain" /> : <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-rule/60 text-xs text-slate">None</span>}
      <span className="min-w-0 flex-1 text-xs text-slate">{busy ? "Uploading…" : hint}</span>
      <label className="btn-ghost cursor-pointer !px-3 !py-1.5 text-xs">
        {value ? "Change" : "Upload"}
        <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); e.target.value = ""; }} />
      </label>
    </div>
  );
}

// /academy/teach/setup: the teacher's one-time setup for their certificates (lib/certificates.ts), with a live preview.
export default function AcademySetup() {
  const { user, profile } = useMember();
  const [f, setF] = useState<Form>(EMPTY);
  const [saved, setSaved] = useState<Academy | null>(null);
  const [minKobo, setMinKobo] = useState(999 * 100);
  const [late, setLate] = useState({ graceDays: 7, weeklyRate: 0.01, capRate: 0.5 });
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!user) return;
    api<{ academy: Academy | null; minKobo: number; late: typeof late; defaults: { name: string; subtext: string; logoUrl: string; signerTitle: string; website: string } | null }>("/api/academy/setup").then((r) => {
      setMinKobo(r.minKobo); setLate(r.late); setSaved(r.academy);
      const a = r.academy;
      setF(a ? {
        name: a.name, subtext: a.subtext, website: a.website.replace(/^https?:\/\//, ""), logoUrl: a.logoUrl, signerName: a.signerName, signerTitle: a.signerTitle,
        signatureUrl: a.signatureUrl, margin: String(a.marginKobo / 100), accName: a.accreditation?.name ?? "", accLogoUrl: a.accreditation?.logoUrl ?? "", accProof: a.accreditation?.proof ?? "",
      } : r.defaults ? { ...EMPTY, name: r.defaults.name, subtext: r.defaults.subtext, logoUrl: r.defaults.logoUrl, signerTitle: r.defaults.signerTitle, website: r.defaults.website.replace(/^https?:\/\//, "") } : EMPTY);
      setLoaded(true);
    }).catch((e) => setError(e.message));
  }, [user]);
  // A first setup starts from the teacher's own name, whenever their profile arrives.
  const me = profile?.displayName ?? "";
  useEffect(() => {
    if (loaded && !saved && me) setF((o) => ({ ...o, name: o.name || me, signerName: o.signerName || me }));
  }, [loaded, saved, me]);

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((o) => ({ ...o, [k]: e.target.value }));
  async function upload(k: "logoUrl" | "signatureUrl" | "accLogoUrl", file: File) {
    setBusy(k); setError("");
    try { const url = await uploadToR2(k === "signatureUrl" ? await whiten(file) : await asPng(file), "academy"); setF((o) => ({ ...o, [k]: url })); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn't upload that picture."); }
    finally { setBusy(""); }
  }
  async function save() {
    setBusy("save"); setError(""); setNote("");
    try {
      const r = await api<{ academy: Academy }>("/api/academy/setup", { body: {
        name: f.name, subtext: f.subtext, website: f.website, logoUrl: f.logoUrl, signerName: f.signerName, signerTitle: f.signerTitle, signatureUrl: f.signatureUrl,
        marginNaira: Number(f.margin || 0), accreditation: f.accName || f.accLogoUrl ? { name: f.accName, logoUrl: f.accLogoUrl, proof: f.accProof } : null,
      } });
      setSaved(r.academy); setNote("Saved. Certificates issued from now on use these details.");
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't save."); }
    finally { setBusy(""); }
  }

  if (user === null) return <div className="mx-auto max-w-3xl px-4 py-16"><p className="card p-6 text-sm">Please <Link href="/login?next=/academy/teach/setup" className="font-semibold text-crimson">sign in</Link> to set up your academy.</p></div>;
  if (!loaded) return <div className="px-6 py-24 text-center text-slate">{error || "Loading…"}</div>;

  const marginKobo = Math.max(0, Math.round(Number(f.margin || 0) * 100)) || 0;
  const acc = saved?.accreditation;
  const accStatus = !f.accName && !f.accLogoUrl ? null : !acc || acc.name !== f.accName || acc.logoUrl !== f.accLogoUrl || acc.proof !== f.accProof ? "unsent" : acc.status;
  const chips: [string, boolean | "wait"][] = [
    ["Name and logo", !!f.name && !!f.logoUrl], ["Signature", !!f.signatureUrl],
    ...(accStatus ? [[accStatus === "approved" ? "Accreditation approved" : accStatus === "rejected" ? "Accreditation: not approved" : "Accreditation: waiting for #NotesApp", accStatus === "approved" ? true : "wait"] as [string, boolean | "wait"]] : []),
    ["Certificate price", true],
  ];
  const sample = faceFor(
    { ownerUid: "", name: f.name, subtext: f.subtext, website: f.website ? `https://${f.website.replace(/^https?:\/\//, "")}` : "", logoUrl: f.logoUrl, signerName: f.signerName, signerTitle: f.signerTitle, signatureUrl: f.signatureUrl, marginKobo, accreditation: acc && acc.status === "approved" && accStatus === "approved" ? acc : null, updatedAt: "" },
    { title: "Your course title", minutes: 24 * 60, ownerName: profile?.displayName ?? "", certified: true },
    { name: "Ada Okoye", completedAt: new Date().toISOString() }, { id: "NA-C-7K2M9QXD", issuedAt: new Date().toISOString() },
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <p className="eyebrow">Notes Academy · One-time setup</p>
      <h1 className="mt-2 font-display text-4xl text-ink sm:text-5xl">Your academy</h1>
      <p className="mt-3 max-w-2xl text-slate">Set this up once. It goes on every certificate your learners earn; the learner&apos;s name, the course, the hours and the date are filled in for you when they finish.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {chips.map(([t, ok]) => <span key={t} className={`rounded-full px-3 py-1 text-xs font-semibold ${ok === true ? "bg-emerald-50 text-emerald-800" : ok === "wait" ? "bg-amber-50 text-amber-900" : "bg-paper text-slate ring-1 ring-rule"}`}>{ok === true ? "✓ " : ""}{t}</span>)}
      </div>
      {error && <p className="mt-4 text-sm text-crimson" role="alert">{error}</p>}

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <div className="min-w-0 space-y-6">
          <section className="card p-5">
            <h2 className="font-display text-2xl text-ink">Who issues the certificate</h2>
            <label className={`${label} mt-4`}>Academy or institution name<input value={f.name} onChange={set("name")} maxLength={80} className={field} /></label>
            <label className={`${label} mt-4`}>Sub-text <span className="font-normal text-slate">(a line under the name)</span><input value={f.subtext} onChange={set("subtext")} maxLength={120} className={field} /></label>
            <label className={`${label} mt-4`}>Website<input value={f.website} onChange={set("website")} placeholder="www.example.com" inputMode="url" className={field} /></label>
            <p className={`${label} mt-4`}>Logo <span className="font-normal text-slate">(PNG with a clear background is best)</span></p>
            <ImagePick value={f.logoUrl} busy={busy === "logoUrl"} hint="Shown at the top of every certificate." onPick={(file) => upload("logoUrl", file)} />
          </section>

          <section className="card p-5">
            <h2 className="font-display text-2xl text-ink">Who signs it</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className={label}>Name<input value={f.signerName} onChange={set("signerName")} maxLength={80} className={field} /></label>
              <label className={label}>Title<input value={f.signerTitle} onChange={set("signerTitle")} maxLength={80} placeholder="Founder & Lead Teacher" className={field} /></label>
            </div>
            <p className={`${label} mt-4`}>Signature <span className="font-normal text-slate">(sign on white paper, photograph it in good light; we remove the white)</span></p>
            <ImagePick value={f.signatureUrl} busy={busy === "signatureUrl"} hint="Without one, the signer's name is written instead." onPick={(file) => upload("signatureUrl", file)} />
          </section>

          <section className="card p-5">
            <h2 className="font-display text-2xl text-ink">Accrediting institution <span className="font-ui text-sm font-normal text-slate">(optional)</span></h2>
            <p className="mt-1 text-sm text-slate">If another body accredits your courses, its logo goes top right. We check it with them first, so it only shows once approved.</p>
            <label className={`${label} mt-4`}>Institution name<input value={f.accName} onChange={set("accName")} maxLength={80} className={field} /></label>
            <p className={`${label} mt-4`}>Their logo</p>
            <ImagePick value={f.accLogoUrl} busy={busy === "accLogoUrl"} hint="The institution's own logo." onPick={(file) => upload("accLogoUrl", file)} />
            <label className={`${label} mt-4`}>Proof <span className="font-normal text-slate">(a link to where they list you, or who we can contact)</span>
              <textarea value={f.accProof} onChange={set("accProof")} rows={2} maxLength={500} className={field} />
            </label>
            {accStatus === "pending" && acc && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">Sent to #NotesApp on {new Date(acc.submittedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}. Usually checked within 3 working days.</p>}
            {accStatus === "rejected" && acc && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">Not approved: {acc.note}. Change the details and save to send it again.</p>}
            {accStatus === "approved" && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">Approved: it shows on your certificates. Changing it sends it back for checking.</p>}
            {accStatus === "unsent" && <p className="mt-3 text-xs text-slate">Saving sends it to #NotesApp for checking.</p>}
          </section>

          <section className="card p-5">
            <h2 className="font-display text-2xl text-ink">Certificate price</h2>
            <p className="mt-1 text-sm text-slate">Your courses are free; learners pay for the certificate. #NotesApp&apos;s part is {naira(minKobo)}. Add your own margin on top: there&apos;s no limit.</p>
            <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
              <label className={`${label} min-w-0 flex-1`}>Your margin, ₦<input value={f.margin} onChange={(e) => setF((o) => ({ ...o, margin: e.target.value.replace(/[^\d.]/g, "") }))} inputMode="decimal" className={field} /></label>
              <p className="pb-2 text-sm text-slate">Learners pay <strong className="font-ui text-xl text-ink">{naira(minKobo + marginKobo)}</strong></p>
            </div>
            <p className="mt-2 text-xs text-slate">You receive {naira(marginKobo)} less our usual commission on it. Learners who claim more than {late.graceDays} days after finishing pay {Math.round(late.weeklyRate * 100)}% more each week, up to +{Math.round(late.capRate * 100)}%; your share grows with it.</p>
          </section>

          <button onClick={save} disabled={!!busy} className="btn-primary !px-6 !py-3">{busy === "save" ? "Saving…" : "Save my academy"}</button>
          {note && <p className="text-sm text-emerald-800" role="status">{note}</p>}
        </div>

        <aside className="min-w-0">
          <div className="lg:sticky lg:top-24">
            <p className="eyebrow">Preview</p>
            <div className="mt-2 rounded-2xl border border-rule bg-card p-2 shadow-sm"><Certificate face={sample} verifyUrl="https://www.notesapp.name.ng/certificates/NA-C-7K2M9QXD" slots /></div>
            <p className="mt-2 text-xs text-slate">A learner&apos;s name, course and date are shown as an example. The top-right space shows an accrediting institution once approved. &quot;#NotesApp Certified Course&quot; (top left) is added by our team to courses we&apos;ve reviewed.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
