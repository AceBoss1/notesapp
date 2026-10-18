"use client";

import { useEffect, useState } from "react";
import { qrSvg } from "@/lib/certificate-qr";
import { certificateDate, type CertificateFace } from "@/lib/certificates";

// One certificate, drawn the same everywhere: the setup preview, the claim preview, the verification page and the PDF (the print page).
// It scales with its box (container query units), landscape A4. The QR code (lib/certificate-qr.ts) points at the verification page.

export default function Certificate({ face, verifyUrl, qr, preview = false, className = "" }: {
  face: CertificateFace; verifyUrl: string; qr?: string; preview?: boolean; className?: string;
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
        {/* faint mark behind the text */}
        <img src={face.logoUrl || "/images/academy/notes-academy-logo.png"} alt="" className="absolute left-1/2 top-[46%] -translate-x-1/2 -translate-y-1/2 opacity-[0.05]" style={{ width: u(30) }} />

        {/* the three logo slots */}
        {face.certified && <img src="/images/academy/notesapp-certified-course.webp" alt="#NotesApp Certified Course" className="absolute" style={{ left: u(4.2), top: u(3.6), width: u(9.5) }} />}
        {face.accreditation ? (
          <div className="absolute flex flex-col items-center" style={{ right: u(4.2), top: u(3.6), width: u(11) }}>
            <img src={face.accreditation.logoUrl} alt="" style={{ maxWidth: u(9), maxHeight: u(7) }} />
            <span style={{ fontSize: u(0.75), marginTop: u(0.4), lineHeight: 1.2 }}>Accredited by {face.accreditation.name}</span>
          </div>
        ) : null}

        {/* the text, centred between the top and the signature row */}
        <div className="absolute inset-x-0 flex flex-col items-center justify-center" style={{ top: u(3.4), bottom: u(16.5), paddingInline: u(16) }}>
          {face.logoUrl && <img src={face.logoUrl} alt="" style={{ maxHeight: u(5.5), maxWidth: u(16) }} />}
          <p className="font-bold uppercase" style={{ fontSize: u(1.9), letterSpacing: u(0.12), marginTop: u(0.6), color: ink }}>{face.academyName}</p>
          {face.subtext && <p className="italic" style={{ fontFamily: "Newsreader, Georgia, serif", fontSize: u(0.95), color: "#4b5563" }}>{face.subtext}</p>}
          <p className="font-bold uppercase" style={{ fontSize: u(1.05), letterSpacing: u(0.42), color: crimson, marginTop: u(2.2) }}>Certificate of completion</p>
          <p style={{ fontSize: u(1.05), marginTop: u(1.3), color: "#4b5563" }}>This is to certify that</p>
          <p className="font-bold" style={{ fontFamily: "Newsreader, Georgia, serif", fontSize: u(face.learnerName.length > 28 ? 3.6 : 4.6), lineHeight: 1.15, marginTop: u(0.3) }}>{face.learnerName}</p>
          <span style={{ width: u(26), height: u(0.12), background: gold, marginTop: u(0.5) }} />
          <p style={{ fontSize: u(1.05), marginTop: u(0.9), color: "#4b5563" }}>has successfully completed</p>
          <p className="font-bold" style={{ fontFamily: "Newsreader, Georgia, serif", fontSize: u(face.courseTitle.length > 48 ? 1.9 : 2.4), color: crimson, lineHeight: 1.2, marginTop: u(0.4) }}>{face.courseTitle}</p>
          <p style={{ fontSize: u(0.9), marginTop: u(0.6), color: "#4b5563" }}>
            offered by {face.academyName} on Notes Academy · {face.hours} learning hour{face.hours === 1 ? "" : "s"} · completed {certificateDate(face.completedAt)}
          </p>
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
          <div className="relative bg-white" style={{ width: u(10), height: u(10) }}>
            {svg && <div className="h-full w-full [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />}
            <span className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center bg-white" style={{ width: u(2.6), height: u(2.6), borderRadius: u(0.6), border: `${u(0.12)} solid ${crimson}` }}>
              <img src="/images/brand/icon-512.png" alt="" style={{ width: u(2) }} />
            </span>
          </div>
        </div>

        <p className="absolute inset-x-0" style={{ bottom: u(2.3), fontSize: u(0.65), color: "#6b7280" }}>
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
