"use client";

import { useState } from "react";
import { useMember } from "@/lib/member-client";

// The buttons on a certificate's page: LinkedIn, X, WhatsApp and Copy link for anyone; for the learner it belongs to, Download PDF, Download
// image (PNG, /certificates/<id>/image.png) and the image's link, to paste into LinkedIn's Add media → Add a link.
export default function CertificateActions({ id, ownerUid, url, learnerName, courseTitle, linkedIn }: { id: string; ownerUid: string; url: string; learnerName: string; courseTitle: string; linkedIn: string }) {
  const { user } = useMember();
  const [copied, setCopied] = useState<"" | "page" | "image">("");
  const image = `${url}/image.png`;
  const copy = (what: "page" | "image") => { void navigator.clipboard?.writeText(what === "image" ? image : url).then(() => { setCopied(what); setTimeout(() => setCopied(""), 1800); }); };
  const mine = user?.uid === ownerUid;
  const text = mine ? `I've completed “${courseTitle}” on Notes Academy. Verify my certificate:` : `${learnerName} completed “${courseTitle}” on Notes Academy:`;
  const btn = "flex items-center justify-center rounded-full border border-rule px-4 py-2.5 font-ui text-sm font-semibold text-ink hover:border-crimson";
  return (
    <div className="mt-6">
      {mine && <a href={linkedIn} target="_blank" rel="noopener noreferrer" className="flex w-full items-center justify-center rounded-full bg-[#0A66C2] px-4 py-3 font-ui text-sm font-bold text-white hover:bg-[#004182]">Add to LinkedIn profile</a>}
      <div className="mt-2 grid grid-cols-2 gap-2">
        <a href={`https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer" className={btn}>Share on X</a>
        <a href={`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`} target="_blank" rel="noopener noreferrer" className={btn}>WhatsApp</a>
        <button type="button" onClick={() => copy("page")} className={btn}>{copied === "page" ? "Copied ✓" : "Copy link"}</button>
        {mine && <a href={`/certificate-print/${id}`} target="_blank" rel="noopener" className={btn}>Download PDF</a>}
        {mine && <a href={`/certificates/${id}/image.png?download=1`} download={`Notes-Academy-certificate-${id}.png`} className={btn}>Download image</a>}
        {mine && <button type="button" onClick={() => copy("image")} className={btn}>{copied === "image" ? "Copied ✓" : "Copy image link"}</button>}
      </div>
      {mine && <p className="mt-3 rounded-lg bg-paper p-3 text-xs text-slate"><strong className="text-ink">The picture on LinkedIn:</strong> after Add to LinkedIn profile, choose <em>Add media → Add a link</em> and paste the image link (Copy image link). Download PDF opens a print-ready copy: choose “Save as PDF”.</p>}
      <p className="mt-3 text-xs text-slate">This page shows only what&apos;s printed on the certificate.</p>
    </div>
  );
}
