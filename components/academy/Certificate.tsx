"use client";

import { useEffect, useState } from "react";
import { qrSvg } from "@/lib/certificate-qr";
import { certificateDate, type CertificateFace } from "@/lib/certificates";

// One certificate, drawn the same everywhere: the setup preview, the claim preview, the verification page and the PDF (the print page).
// It scales with its box (container query units), landscape A4. The QR code (lib/certificate-qr.ts) points at the verification page.

export default function Certificate({ face, verifyUrl, qr, preview = false, slots = false, className = "" }: {
  face: CertificateFace; verifyUrl: string; qr?: string; preview?: boolean; slots?: boolean; className?: string; // slots: show the empty accreditation place (setup preview)
}) {
  const [svg, setSvg] = useState(qr ?? "");
  useEffect(() => { if (!qr) void qrSvg(verifyUrl).then(setSvg).catch(() => {}); }, [qr, verifyUrl]);
  const u = (n: number) => `${n}cqw`; // a share of the certificate's width
  const ink = "#14213D", crimson = "#7A0328", gold = "#C9A227";
  return (
    <div className={`w-full ${className}`} style={{ containerType: "inline-size" }}>
      <div className="relative w-full overflow-hidden bg-[#FFFDF8] text-center" style={{ aspectRatio: "1.414", fontFamily: "Inter, sans-serif", color: ink }} aria-label={`Certificate ${face.id} for ${face.learnerName}`}>
        {/* frame and corners */}
        <div className="absolute" style={{ inset: u(1.2), border: `${u(0.35)} solid ${crimson}` }} />
        <div className="absolute" style={{ inset: u(1.9), border: `${u(0.12)} solid ${gold}` }} />
        {[["left", "top"], ["right", "top"], ["left", "bottom"], ["right", "bottom"]].map(([x, y]) => (
          <span key={x + y} className="absolute rotate-45" style={{ [x]: u(1.55), [y]: u(1.55), width: u(1.1), height: u(1.1), background: gold }} />
        ))}
        {/* faint mark behind the text: the academy's logo (our team's courses: the Notes Academy logo) */}
        {face.logoUrl && <img src={face.logoUrl} alt="" className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.06]" style={{ width: u(30) }} />}

        {/* the three logo slots: every element keeps its place whether or not a slot is filled */}
        {face.certified && <img src="/images/academy/notesapp-certified-course.webp" alt="#NotesApp Certified Course" className="absolute" style={{ left: u(5.4), top: u(5), width: u(11.5) }} />}
        {face.accreditation ? (
          <div className="absolute flex flex-col items-center justify-center text-center" style={{ right: u(5), top: u(5), width: u(12), height: u(12) }}>
            <img src={face.accreditation.logoUrl} alt="" style={{ maxWidth: u(10), maxHeight: u(8.5), objectFit: "contain" }} />
            <span style={{ fontSize: u(0.75), marginTop: u(0.4), lineHeight: 1.2 }}>Accredited by {face.accreditation.name}</span>
          </div>
        ) : slots ? (
          <div className="absolute flex items-center justify-center rounded-full text-center" style={{ right: u(5), top: u(5), width: u(11.5), height: u(11.5), border: `${u(0.1)} dashed #cbd5e1`, color: "#94a3b8", fontSize: u(0.75), padding: u(1.5), lineHeight: 1.25 }}>
            Accrediting institution&apos;s logo appears here when approved
          </div>
        ) : null}
        <div className="absolute left-1/2 flex -translate-x-1/2 items-end justify-center" style={{ top: u(4.6), height: u(8.6), width: u(30) }}>
          {face.logoUrl && <img src={face.logoUrl} alt="" style={{ maxHeight: u(8.6), maxWidth: u(30), objectFit: "contain" }} />}
        </div>

        {/* who issues it, under the logo, in fixed places */}
        <p className="absolute inset-x-0 font-bold uppercase" style={{ top: u(13.6), fontSize: u(1.9), letterSpacing: u(0.12), color: ink, paddingInline: u(14) }}>{face.academyName}</p>
        {face.subtext && <p className="absolute inset-x-0 italic" style={{ top: u(16.3), fontFamily: "Newsreader, Georgia, serif", fontSize: u(0.95), color: "#4b5563", paddingInline: u(14) }}>{face.subtext}</p>}

        {/* "Certificate of completion" to the date: one block whose middle is the exact centre of the certificate */}
        <div className="absolute inset-x-0 flex -translate-y-1/2 flex-col items-center" style={{ top: "50%", paddingInline: u(12) }}>
          <p className="font-extrabold uppercase" style={{ fontSize: u(1.45), letterSpacing: u(0.5), color: crimson }}>Certificate of completion</p>
          <p style={{ fontSize: u(1.3), color: "#4b5563", marginTop: u(1.6) }}>This is to certify that</p>
          <p className="font-bold" style={{ fontFamily: "Newsreader, Georgia, serif", fontSize: u(face.learnerName.length > 40 ? 3.2 : face.learnerName.length > 28 ? 4.2 : 5.4), lineHeight: 1.1, whiteSpace: "nowrap", marginTop: u(0.6) }}>{face.learnerName}</p>
          <span className="block" style={{ width: u(29), height: u(0.14), background: `linear-gradient(90deg, transparent, ${gold}, transparent)`, marginTop: u(0.9) }} />
          <p style={{ fontSize: u(1.35), color: "#4b5563", marginTop: u(1.3) }}>has successfully completed</p>
          <p className="font-bold" style={{ fontFamily: "Newsreader, Georgia, serif", fontSize: u(face.courseTitle.length > 70 ? 1.7 : face.courseTitle.length > 48 ? 2.2 : 2.8), color: crimson, lineHeight: 1.2, whiteSpace: "nowrap", marginTop: u(0.7) }}>{face.courseTitle}</p>
          <p style={{ fontSize: u(1.2), color: "#4b5563", marginTop: u(0.9) }}>offered by {face.academyName}{face.academyName === "Notes Academy" ? "" : " on Notes Academy"} · {face.hours} learning hour{face.hours === 1 ? "" : "s"} · completed {certificateDate(face.completedAt)}</p>
        </div>

        {/* signature */}
        <div className="absolute text-left" style={{ left: u(5), bottom: u(4.6), width: u(28) }}>
          {face.signatureUrl
            ? <img src={face.signatureUrl} alt="" style={{ height: u(4.2), maxWidth: u(22), objectFit: "contain", objectPosition: "left bottom" }} />
            // No signature uploaded: the signer's name in a thin handwritten script (its file only loads when it's used).
            : <p style={{ fontFamily: "'Mrs Saint Delafield', 'Brush Script MT', cursive", fontSize: u(3.4), lineHeight: 1.15, color: ink, whiteSpace: "nowrap" }}>{face.signerName}</p>}
          <span className="block" style={{ width: u(18), height: u(0.1), background: ink, marginTop: u(0.2) }} />
          <p className="font-bold" style={{ fontSize: u(1), marginTop: u(0.4) }}>{face.signerName}</p>
          {face.signerTitle && <p style={{ fontSize: u(0.8), color: "#4b5563" }}>{face.signerTitle}</p>}
          {face.website && <p style={{ fontSize: u(0.75), color: crimson }}>{face.website.replace(/^https?:\/\//, "")}</p>}
        </div>

        {/* date and ID */}
        <div className="absolute left-1/2 -translate-x-1/2" style={{ bottom: u(4.8) }}>
          <p className="font-bold uppercase" style={{ fontSize: u(0.7), letterSpacing: u(0.2), color: crimson }}>Issued</p>
          <p style={{ fontSize: u(0.95) }}>{certificateDate(face.issuedAt)}</p>
          <p className="font-bold uppercase" style={{ fontSize: u(0.7), letterSpacing: u(0.2), color: crimson, marginTop: u(0.7) }}>Certificate ID</p>
          <p className="font-bold" style={{ fontFamily: "ui-monospace, monospace", fontSize: u(1.05) }}>{face.id}</p>
        </div>

        {/* seal and QR */}
        <div className="absolute flex items-center" style={{ right: u(4.6), bottom: u(4.2), gap: u(1.2) }}>
          <img src="/images/academy/notes-academy-verifiable-certificate.webp" alt="Notes Academy Verifiable Certificate" style={{ width: u(7.5) }} />
          <div className="flex flex-col items-center">
          <span className="font-bold uppercase" style={{ fontSize: u(0.62), letterSpacing: u(0.18), color: crimson, marginBottom: u(0.35) }}>Scan to verify</span>
          <div className="relative bg-white" style={{ width: u(10), height: u(10) }}>
            {svg && <div className="h-full w-full [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />}
            <span className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center bg-white" style={{ width: u(2.6), height: u(2.6), borderRadius: u(0.6), border: `${u(0.12)} solid ${crimson}` }}>
              <img src="/images/brand/icon-512.png" alt="" style={{ width: u(2) }} />
            </span>
          </div>
          </div>
        </div>

        <p className="absolute inset-x-0 flex items-center justify-center" style={{ bottom: u(2.3), fontSize: u(0.65), color: "#6b7280", gap: u(0.5) }}>
          <img src="/images/brand/icon-512.png" alt="" style={{ width: u(1.1), height: u(1.1) }} />
          Issued through Notes Academy on #NotesApp · verify at {verifyUrl.replace(/^https?:\/\//, "")}
        </p>

        {preview && (
          <div className="absolute inset-0 flex items-center justify-center backdrop-blur-[2px]">
            <span className="-rotate-[18deg] rounded-xl font-bold uppercase" style={{ border: `${u(0.5)} solid rgba(122,3,40,.55)`, color: "rgba(122,3,40,.6)", fontSize: u(6), letterSpacing: u(0.6), padding: `${u(0.6)} ${u(2.4)}` }}>Preview</span>
          </div>
        )}
      </div>
    </div>
  );
}
