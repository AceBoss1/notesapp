"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { PORTRAIT_PROMPT_MAX, PORTRAIT_SIDE, PORTRAIT_STRENGTH, PORTRAIT_STYLES, PORTRAIT_UPLOAD_MAX, type PortraitAccess } from "@/lib/nana-portrait";
import "./nana-studio.css";

// Nana AI, the portrait studio (lib/nana-portrait.ts, docs/NANA_PORTRAIT_STUDIO.md): the owner's v0 design, now on the main app so it
// signs in with NotesApp on its own address (nana.<domain>/signin, like Exam Prep) and calls our own /api/portrait routes.
// base: "" on nana.<domain>, "/nana-studio" anywhere else (localhost and previews). pricingUrl: the main site's pricing in this family.
const MASCOT = "/images/nana/nana-sm.webp";
const MARK = "/images/brand/icon-192.png";
type Ic = "login" | "logout" | "download" | "reset" | "check" | "upload" | "arrow" | "spark" | "plan" | "spin";
const PATHS: Record<Ic, string> = {
  login: "M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3",
  logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
  download: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3",
  reset: "M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8M3 3v5h5",
  check: "M20 6 9 17l-5-5",
  upload: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12",
  arrow: "M5 12h14M12 5l7 7-7 7",
  spark: "M12 3l1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2z",
  plan: "M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7zM5 20h14",
  spin: "M21 12a9 9 0 1 1-6.22-8.56",
};
function Icon({ n, size = 16, className }: { n: Ic; size?: number; className?: string }) {
  return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={PATHS[n]} /></svg>;
}
// The chosen photo made smaller in the browser (long side PORTRAIT_SIDE, JPEG), so it travels quickly and fits the engine's limit.
async function shrink(file: Blob): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const r = Math.min(1, PORTRAIT_SIDE / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(bmp.width * r)); c.height = Math.max(1, Math.round(bmp.height * r));
  const g = c.getContext("2d");
  if (!g) throw new Error("Could not prepare this photo. Please try another image.");
  g.drawImage(bmp, 0, 0, c.width, c.height); bmp.close();
  const out = await new Promise<Blob | null>((res) => c.toBlob(res, "image/jpeg", 0.88));
  if (!out) throw new Error("Could not prepare this photo. Please try another image.");
  return out;
}

export default function PortraitStudio({ base, pricingUrl }: { base: string; pricingUrl: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<{ file: File; url: string } | null>(null);
  const [style, setStyle] = useState(0);
  const [note, setNote] = useState("");
  const [strength, setStrength] = useState<number>(PORTRAIT_STRENGTH.initial);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [user, setUser] = useState<User | null | undefined>(undefined); // undefined while sign-in is being checked
  const [access, setAccess] = useState<PortraitAccess | null>(null);
  const [accessErr, setAccessErr] = useState("");

  const loadAccess = useCallback(async (u: User) => {
    setAccessErr("");
    try {
      const res = await fetch("/api/portrait/access", { headers: { Authorization: `Bearer ${await u.getIdToken()}` }, cache: "no-store" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Could not load your NotesApp plan.");
      setAccess(j as PortraitAccess);
    } catch (e) { setAccessErr(e instanceof Error ? e.message : "Could not load your NotesApp plan."); }
  }, []);
  useEffect(() => onAuthStateChanged(auth, (u) => { setUser(u); setAccess(null); if (u) void loadAccess(u); }), [loadAccess]);
  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo.url); }, [photo]);

  const signIn = () => { window.location.assign(`${base}/signin?next=${encodeURIComponent(`${window.location.pathname}${window.location.search}` || "/")}`); };
  const pick = (f: File | undefined) => {
    if (!f) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) { setErr("Choose a JPG, PNG or WEBP image to get started."); return; }
    if (f.size > PORTRAIT_UPLOAD_MAX) { setErr("Choose an image smaller than 20 MB."); return; }
    setPhoto({ file: f, url: URL.createObjectURL(f) }); setResult(null); setErr("");
  };
  const reset = () => { setPhoto(null); setResult(null); setErr(""); };

  async function create() {
    if (!user) { signIn(); return; }
    if (!user.emailVerified) { setErr("Verify your NotesApp email before creating a portrait."); return; }
    if (!access) { setErr("Checking your NotesApp plan… try again in a moment."); return; }
    if (!access.open) { setErr(access.closed || "Nana AI isn't open to your account yet."); return; }
    if (!access.ready) { setErr("Nana AI isn't set up yet: it needs an image model. Please try again later."); return; }
    if (!photo) { setErr("Upload a photo first."); fileRef.current?.click(); return; }
    setBusy(true); setErr("");
    try {
      const form = new FormData();
      form.set("image", await shrink(photo.file), "portrait.jpg");
      form.set("style", PORTRAIT_STYLES[style].id);
      form.set("prompt", note.trim());
      form.set("intensity", String(strength));
      const res = await fetch("/api/portrait/generate", { method: "POST", headers: { Authorization: `Bearer ${await user.getIdToken()}` }, body: form });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Portrait generation could not finish. Please try again.");
      if (typeof j.image !== "string" || !j.image.startsWith("data:image/")) throw new Error("The portrait came back empty. Please try again.");
      setResult(j.image);
      setAccess((a) => (a ? { ...a, left: typeof j.left === "number" ? j.left : a.left } : a));
    } catch (e) { setErr(e instanceof Error ? e.message : "Portrait generation could not finish. Please try again."); }
    finally { setBusy(false); }
  }
  const download = () => {
    if (!result) return;
    const a = document.createElement("a");
    a.href = result; a.download = `nana-professional-portrait.${result.startsWith("data:image/png") ? "png" : "webp"}`; a.click();
  };

  const paid = access?.paid === true;
  const s = PORTRAIT_STYLES[style];
  const planLine = user === undefined ? "Checking NotesApp sign-in…"
    : !user ? "Sign in with NotesApp to create portraits."
    : !user.emailVerified ? "Verify your NotesApp email before creating a portrait."
    : accessErr ? "Could not load your NotesApp plan yet."
    : !access ? "Checking your NotesApp plan…"
    : !access.open ? (access.closed || "Nana AI opens to everyone soon.")
    : `${paid ? "Your paid NotesApp plan removes the watermark." : "Free portraits include the NotesApp watermark."}${access.limit ? ` ${access.left} of ${access.limit} left today.` : ""}`;
  const shown = result || photo?.url || "";

  return (
    <main className="nana-app" data-theme-off="">
      <header className="topbar">
        <a className="brand" href={base || "/"} aria-label="Nana AI home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="brand-mascot" src={MASCOT} alt="" />
          <span className="brand-copy"><span>Nana AI</span><small>Professional portrait studio</small></span>
        </a>
        <div className="topbar-center"><span className="status-dot" /> For journals and profiles</div>
        <div className="topbar-actions">
          {user
            ? <button className="top-action" type="button" onClick={() => void signOut(auth).then(reset).catch(() => setErr("Could not sign out of NotesApp. Please try again."))} aria-label="Sign out of NotesApp"><Icon n="logout" size={15} /> <span>Sign out</span></button>
            : <button className="top-action" type="button" onClick={signIn}><Icon n="login" size={15} /> <span>NotesApp login</span></button>}
          <button className="top-action" type="button" onClick={download} disabled={!result} aria-label="Export generated portrait"><Icon n="download" /> <span>Export</span></button>
        </div>
      </header>

      <section className="editor-shell" id="home">
        <div className="editor-heading">
          <div>
            <p className="eyebrow">A PORTRAIT FOR YOUR NEXT CHAPTER</p>
            <h1>Your story, <span>in focus.</span></h1>
            <p className="intro">Create a polished professional portrait for your journal byline or profile.</p>
          </div>
          <div className="step-pill" aria-label="Step 1 of 1: Create portrait"><span className="step-number">1</span> Create portrait</div>
        </div>

        <div className="editor-layout">
          <aside className="controls-panel">
            <div className="panel-title-row">
              <div><span className="step-label">STEP 01</span><h2>Your portrait</h2></div>
              <button className="icon-button" type="button" aria-label="Clear the photo" onClick={reset}><Icon n="reset" size={15} /></button>
            </div>
            <div className="plan-note" role="status">
              <strong><Icon n="plan" size={14} /> {user && access ? (paid ? `NotesApp ${access.tier}` : `NotesApp ${access.tier} plan`) : "NotesApp account"}</strong>
              <p>{planLine}</p>
              {user && access && !paid && <a href={pricingUrl}>Explore paid plans</a>}
            </div>
            <button className="upload-box" type="button" onClick={() => fileRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files[0]); }}>
              <span className="upload-icon"><Icon n="upload" size={19} /></span>
              <span className="upload-copy"><strong>{photo ? photo.file.name.slice(0, 40) : "Upload a photo"}</strong><small>JPG, PNG or WEBP · up to 20 MB</small></span>
              <Icon n="arrow" className="upload-arrow" size={17} />
            </button>
            <input ref={fileRef} className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} aria-label="Upload a portrait photo" />

            <div className="form-divider" />
            <div className="section-label"><span className="step-label">STEP 02</span><span>Pick your style</span></div>
            <div className="style-list" role="radiogroup" aria-label="Portrait style">
              {PORTRAIT_STYLES.map((x, i) => (
                <button key={x.id} type="button" className={`style-option ${style === i ? "selected" : ""}`} role="radio" aria-checked={style === i} onClick={() => setStyle(i)}>
                  <span className="style-swatch" />
                  <span className="style-copy"><strong>{x.name}</strong><small>{x.note}</small></span>
                  <span className="radio-check">{style === i && <Icon n="check" size={12} />}</span>
                </button>
              ))}
            </div>

            <div className="form-divider prompt-divider" />
            <label className="prompt-label" htmlFor="nana-prompt">Make it yours <span>OPTIONAL</span></label>
            <textarea id="nana-prompt" value={note} onChange={(e) => setNote(e.target.value)} maxLength={PORTRAIT_PROMPT_MAX} rows={3} placeholder="e.g. soft window light and an ivory background" />
            <div className="range-row"><label htmlFor="nana-intensity">Style strength</label><span>{strength}%</span></div>
            <input id="nana-intensity" className="strength-range" type="range" min={PORTRAIT_STRENGTH.min} max={PORTRAIT_STRENGTH.max} value={strength} onChange={(e) => setStrength(Number(e.target.value))} />
            {(err || accessErr) && <p className="error-message" role="alert">{err || accessErr}</p>}
            <button className="generate-button" type="button" onClick={() => void create()} disabled={busy}>
              {busy ? <Icon n="spin" className="spin" size={17} /> : <Icon n={user ? "spark" : "login"} size={17} />}{" "}
              {busy ? "Creating your portrait…" : user ? (result ? "Create another portrait" : "Create my portrait") : "Sign in with NotesApp"}{" "}
              <span className="button-sparkle"><Icon n="spark" size={14} /></span>
            </button>
            <p className="privacy-note">Your photo is sent for generation and is not saved by Nana.</p>
          </aside>

          <section className="preview-panel" aria-label="Portrait preview">
            <div className="preview-toolbar">
              <div className="preview-title"><span className="live-indicator" />{result ? "PROFESSIONAL PORTRAIT" : "PHOTO PREVIEW"}</div>
              <span className="plan-badge">{user ? (paid ? "No watermark" : "Nana watermark") : "NotesApp sign-in"}</span>
            </div>
            <div className="artboard">
              <div className="artboard-grid" />
              <div className="portrait-frame">
                {shown
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img className={`portrait-image ${result ? "is-generated" : ""}`} src={shown} alt={result ? "AI-generated professional portrait" : "Your photo"} />
                  : <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#f5dfe6", fontSize: 12, textAlign: "center", padding: 24 }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <span><img src={MASCOT} alt="" style={{ width: 96, height: 96, objectFit: "contain", margin: "0 auto 12px", display: "block", opacity: 0.95 }} />Upload a photo of yourself to begin</span>
                    </div>}
                {result && <span className="portrait-badge"><Icon n="spark" size={12} /> Profile ready</span>}
                {!result && photo && !paid && user && (
                  // A preview of where the mark goes on a free plan; on the portrait itself it is drawn by our server.
                  <div className="canvas-watermark" style={{ opacity: 0.7 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img className="watermark-mark" src={MARK} alt="" /><span>Made with Nana AI</span>
                  </div>
                )}
              </div>
              <div className="canvas-caption"><span>{result ? "Ready for a journal byline or profile" : "Upload a photo to begin"}</span><Icon n="spark" className="caption-star" size={14} /></div>
            </div>
            <div className="preview-footer">
              <div className="preview-file">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <span className="file-thumb">{shown ? <img src={shown} alt="" /> : <img src={MASCOT} alt="" />}</span>
                <span><strong>{result ? "Your professional portrait" : photo ? photo.file.name : "No photo yet"}</strong><small>{result ? `${s.name} · ${strength}% style` : "Ready to transform"}</small></span>
              </div>
              <button className="download-small" type="button" onClick={download} disabled={!result} aria-label="Download portrait"><Icon n="download" size={17} /></button>
            </div>
          </section>
        </div>
        <footer className="page-footer"><span>Made for journal bylines, profiles, and the moments you want to keep.</span><span>Powered by your NotesApp account.</span></footer>
      </section>
    </main>
  );
}
