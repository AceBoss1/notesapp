import { ImageResponse } from "next/og";
import { readFile } from "fs/promises";
import path from "path";
import { qrSvg } from "./certificate-qr";
import { NOTES_ACADEMY_LOGO, certificateDate, type CertificateFace } from "./certificates";

// A certificate as a picture (PNG), for people to download and for link previews: /certificates/<id>/image.png. Server only.
// The same layout as components/academy/Certificate.tsx, in pixels: everything is a share of the width (u), as there.
//   full: the certificate alone, 2000 × 1414 (landscape A4)
//   og:   1200 × 630 with the certificate in the middle, for link previews (LinkedIn's Add media → Add a link, X, WhatsApp)
// The fonts are in assets/fonts (OFL). Pictures must be PNG, JPEG or SVG (the renderer can't read WebP); one it can't read is left out.

const ink = "#14213D", crimson = "#7A0328", gold = "#C9A227", grey = "#4b5563";
type Font = { name: string; data: Buffer; weight: 400 | 600 | 700 | 800; style: "normal" | "italic" };
const read = (p: string) => readFile(path.join(process.cwd(), p));

let fonts: Promise<Font[]> | null = null;
function loadFonts(): Promise<Font[]> {
  const f = (name: string, file: string, weight: Font["weight"], style: Font["style"] = "normal") => read(`assets/fonts/${file}`).then((data) => ({ name, data, weight, style }));
  fonts ??= Promise.all([
    f("Inter", "Inter-400.ttf", 400), f("Inter", "Inter-600.ttf", 600), f("Inter", "Inter-700.ttf", 700), f("Inter", "Inter-800.ttf", 800),
    f("Newsreader", "Newsreader-700.ttf", 700), f("Newsreader", "Newsreader-400-italic.ttf", 400, "italic"),
    f("Script", "MrsSaintDelafield-400.ttf", 400), f("Mono", "JetBrainsMono-700.ttf", 700),
  ]).catch((e) => { fonts = null; throw e; });
  return fonts;
}

const sniff = (b: Buffer) =>
  b[0] === 0x89 && b[1] === 0x50 ? "image/png" : b[0] === 0xff && b[1] === 0xd8 ? "image/jpeg" : /^\s*(<\?xml|<svg)/.test(b.subarray(0, 100).toString("utf8")) ? "image/svg+xml" : null;
// Our own pictures from the disk (WebP ones have a PNG copy beside them), uploaded ones from the bucket.
async function picture(src: string): Promise<string | null> {
  if (!src) return null;
  try {
    let b: Buffer;
    if (src.startsWith("/")) b = await read(src === NOTES_ACADEMY_LOGO ? "assets/certificate-logo.png" : path.join("public", src.replace(/\.webp$/, ".png")));
    else {
      if (!src.startsWith("https://")) return null;
      const r = await fetch(src, { signal: AbortSignal.timeout(6000) });
      if (!r.ok) return null;
      b = Buffer.from(await r.arrayBuffer());
      if (b.length > 5_000_000) return null;
    }
    const type = sniff(b);
    return type ? `data:${type};base64,${b.toString("base64")}` : null;
  } catch { return null; }
}

type Pics = { logo: string | null; accreditation: string | null; signature: string | null; certified: string | null; seal: string | null; mark: string | null; qr: string };

function Face({ face, verifyUrl, p, W, revoked }: { face: CertificateFace; verifyUrl: string; p: Pics; W: number; revoked: boolean }) {
  const u = (n: number) => (n * W) / 100;
  const H = Math.round(W / 1.414);
  const row = { display: "flex" } as const;
  const name = face.learnerName.length > 40 ? 3.2 : face.learnerName.length > 28 ? 4.2 : 5.4;
  const course = face.courseTitle.length > 70 ? 1.7 : face.courseTitle.length > 48 ? 2.2 : 2.8;
  return (
    <div style={{ ...row, position: "relative", width: W, height: H, background: "#FFFDF8", fontFamily: "Inter", color: ink }}>
      <div style={{ ...row, position: "absolute", left: u(1.2), top: u(1.2), right: u(1.2), bottom: u(1.2), border: `${u(0.35)}px solid ${crimson}` }} />
      <div style={{ ...row, position: "absolute", left: u(1.9), top: u(1.9), right: u(1.9), bottom: u(1.9), border: `${u(0.12)}px solid ${gold}` }} />
      {[["left", "top"], ["right", "top"], ["left", "bottom"], ["right", "bottom"]].map(([x, y]) => (
        <div key={x + y} style={{ ...row, position: "absolute", [x]: u(1.55), [y]: u(1.55), width: u(1.1), height: u(1.1), background: gold, transform: "rotate(45deg)" }} />
      ))}
      {p.logo && <img src={p.logo} alt="" width={u(30)} height={u(30)} style={{ position: "absolute", left: (W - u(30)) / 2, top: (H - u(30)) / 2, opacity: 0.06, objectFit: "contain" }} />}

      {p.certified && face.certified && <img src={p.certified} alt="" width={u(11.5)} height={u(11.5)} style={{ position: "absolute", left: u(5.4), top: u(5) }} />}
      {face.accreditation && (
        <div style={{ ...row, position: "absolute", right: u(5), top: u(5), width: u(12), height: u(12), flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
          {p.accreditation && <img src={p.accreditation} alt="" width={u(10)} height={u(8.5)} style={{ objectFit: "contain" }} />}
          <div style={{ ...row, fontSize: u(0.75), marginTop: u(0.4), lineHeight: 1.2, textAlign: "center" }}>Accredited by {face.accreditation.name}</div>
        </div>
      )}
      {p.logo && <img src={p.logo} alt="" width={u(30)} height={u(8.6)} style={{ position: "absolute", left: (W - u(30)) / 2, top: u(4.6), objectFit: "contain", objectPosition: "bottom" }} />}

      <div style={{ ...row, position: "absolute", left: u(14), right: u(14), top: u(13.6), justifyContent: "center", fontSize: u(1.9), fontWeight: 700, letterSpacing: u(0.12), textTransform: "uppercase" }}>{face.academyName}</div>
      {face.subtext && <div style={{ ...row, position: "absolute", left: u(14), right: u(14), top: u(16.3), justifyContent: "center", fontFamily: "Newsreader", fontStyle: "italic", fontSize: u(0.95), color: grey }}>{face.subtext}</div>}

      {/* "Certificate of completion" to the date: one block whose middle is the certificate's middle */}
      <div style={{ ...row, position: "absolute", left: u(12), right: u(12), top: 0, bottom: 0, flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
        <div style={{ ...row, fontSize: u(1.45), fontWeight: 800, letterSpacing: u(0.5), color: crimson, textTransform: "uppercase" }}>Certificate of completion</div>
        <div style={{ ...row, fontSize: u(1.3), color: grey, marginTop: u(1.6) }}>This is to certify that</div>
        <div style={{ ...row, fontFamily: "Newsreader", fontWeight: 700, fontSize: u(name), lineHeight: 1.1, marginTop: u(0.6), whiteSpace: "nowrap" }}>{face.learnerName}</div>
        <div style={{ ...row, width: u(29), height: u(0.14), marginTop: u(0.9), backgroundImage: `linear-gradient(90deg, rgba(201,162,39,0), ${gold}, rgba(201,162,39,0))` }} />
        <div style={{ ...row, fontSize: u(1.35), color: grey, marginTop: u(1.3) }}>has successfully completed</div>
        <div style={{ ...row, fontFamily: "Newsreader", fontWeight: 700, fontSize: u(course), color: crimson, lineHeight: 1.2, marginTop: u(0.7), whiteSpace: "nowrap" }}>{face.courseTitle}</div>
        <div style={{ ...row, fontSize: u(1.2), color: grey, marginTop: u(0.9) }}>
          {`offered by ${face.academyName}${face.academyName === "Notes Academy" ? "" : " on Notes Academy"} · ${face.hours} learning hour${face.hours === 1 ? "" : "s"} · completed ${certificateDate(face.completedAt)}`}
        </div>
      </div>

      <div style={{ ...row, position: "absolute", left: u(5), bottom: u(4.6), width: u(28), flexDirection: "column", alignItems: "flex-start" }}>
        {p.signature
          ? <img src={p.signature} alt="" width={u(22)} height={u(4.2)} style={{ objectFit: "contain", objectPosition: "left bottom" }} />
          : <div style={{ ...row, fontFamily: "Script", fontSize: u(3.4), lineHeight: 1.15, whiteSpace: "nowrap" }}>{face.signerName}</div>}
        <div style={{ ...row, width: u(18), height: u(0.1), background: ink, marginTop: u(0.2) }} />
        <div style={{ ...row, fontSize: u(1), fontWeight: 700, marginTop: u(0.4) }}>{face.signerName}</div>
        {face.signerTitle && <div style={{ ...row, fontSize: u(0.8), color: grey }}>{face.signerTitle}</div>}
        {face.website && <div style={{ ...row, fontSize: u(0.75), color: crimson }}>{face.website.replace(/^https?:\/\//, "")}</div>}
      </div>

      <div style={{ ...row, position: "absolute", left: 0, right: 0, bottom: u(4.8), flexDirection: "column", alignItems: "center" }}>
        <div style={{ ...row, fontSize: u(0.7), fontWeight: 700, letterSpacing: u(0.2), color: crimson }}>ISSUED</div>
        <div style={{ ...row, fontSize: u(0.95) }}>{certificateDate(face.issuedAt)}</div>
        <div style={{ ...row, fontSize: u(0.7), fontWeight: 700, letterSpacing: u(0.2), color: crimson, marginTop: u(0.7) }}>CERTIFICATE ID</div>
        <div style={{ ...row, fontFamily: "Mono", fontWeight: 700, fontSize: u(1.05) }}>{face.id}</div>
      </div>

      <div style={{ ...row, position: "absolute", right: u(4.6), bottom: u(4.2), alignItems: "center" }}>
        {p.seal && <img src={p.seal} alt="" width={u(7.5)} height={u(7.5)} style={{ marginRight: u(1.2) }} />}
        <div style={{ ...row, flexDirection: "column", alignItems: "center" }}>
          <div style={{ ...row, fontSize: u(0.62), fontWeight: 700, letterSpacing: u(0.18), color: crimson, marginBottom: u(0.35) }}>SCAN TO VERIFY</div>
          <div style={{ ...row, position: "relative", width: u(10), height: u(10), background: "#fff" }}>
            <img src={p.qr} alt="" width={u(10)} height={u(10)} />
            <div style={{ ...row, position: "absolute", left: u(3.7), top: u(3.7), width: u(2.6), height: u(2.6), alignItems: "center", justifyContent: "center", background: "#fff", borderRadius: u(0.6), border: `${u(0.12)}px solid ${crimson}` }}>
              {p.mark && <img src={p.mark} alt="" width={u(2)} height={u(2)} />}
            </div>
          </div>
        </div>
      </div>

      <div style={{ ...row, position: "absolute", left: 0, right: 0, bottom: u(2.3), justifyContent: "center", alignItems: "center", fontSize: u(0.65), color: "#6b7280" }}>
        {p.mark && <img src={p.mark} alt="" width={u(1.1)} height={u(1.1)} style={{ marginRight: u(0.5) }} />}
        {`Issued through Notes Academy on #NotesApp · verify at ${verifyUrl.replace(/^https?:\/\//, "")}`}
      </div>

      {revoked && (
        <div style={{ ...row, position: "absolute", left: 0, top: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", background: "rgba(255,253,248,0.55)" }}>
          <div style={{ ...row, transform: "rotate(-18deg)", border: `${u(0.5)}px solid rgba(185,28,28,.75)`, color: "rgba(185,28,28,.8)", fontSize: u(7), fontWeight: 800, letterSpacing: u(0.6), padding: `${u(0.6)}px ${u(2.4)}px`, borderRadius: u(1) }}>REVOKED</div>
        </div>
      )}
    </div>
  );
}

export async function certificateImage(face: CertificateFace, verifyUrl: string, opts: { og?: boolean; revoked?: boolean; headers?: Record<string, string> } = {}): Promise<ImageResponse> {
  const [fontList, logo, accreditation, signature, certified, seal, mark, qr] = await Promise.all([
    loadFonts(), picture(face.logoUrl), picture(face.accreditation?.logoUrl ?? ""), picture(face.signatureUrl),
    picture("/images/academy/notesapp-certified-course.png"), picture("/images/academy/notes-academy-verifiable-certificate.png"), picture("/images/brand/icon-512.png"),
    qrSvg(verifyUrl).then((s) => `data:image/svg+xml;base64,${Buffer.from(s).toString("base64")}`),
  ]);
  const p: Pics = { logo, accreditation, signature, certified, seal, mark, qr };
  const revoked = !!opts.revoked;
  if (!opts.og) return new ImageResponse(<Face face={face} verifyUrl={verifyUrl} p={p} W={2000} revoked={revoked} />, { width: 2000, height: 1414, fonts: fontList, headers: opts.headers });
  // The link preview: the certificate on our crimson, with a soft shadow.
  const W = 820;
  return new ImageResponse(
    <div style={{ display: "flex", width: 1200, height: 630, alignItems: "center", justifyContent: "center", backgroundImage: "linear-gradient(135deg, #4E0119, #7A0328 55%, #A6093D)" }}>
      <div style={{ display: "flex", boxShadow: "0 18px 50px rgba(0,0,0,.35)" }}><Face face={face} verifyUrl={verifyUrl} p={p} W={W} revoked={revoked} /></div>
    </div>,
    { width: 1200, height: 630, fonts: fontList, headers: opts.headers },
  );
}
