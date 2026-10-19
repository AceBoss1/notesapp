"use client";

import { useState } from "react";

// "Share this course": WhatsApp, LinkedIn, X and Facebook (each opens its own share window), and Copy link.
const btn = "flex h-10 w-10 items-center justify-center rounded-full text-white transition-transform hover:scale-105";
const G = ({ d }: { d: string }) => <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="currentColor" aria-hidden="true"><path d={d} /></svg>;
const WA = "M12 2.5a9.4 9.4 0 0 0-8.1 14.2L2.6 21.5l4.9-1.3A9.4 9.4 0 1 0 12 2.5Zm5.4 13.2c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.5-3.9-4.7-4.1-.1-.2-1.1-1.5-1.1-2.9s.7-2 1-2.3c.2-.3.6-.4.8-.4h.6c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .6l-.4.6-.4.4c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.3 2.4 1.5.3.1.5.1.6-.1l.9-1.1c.2-.3.4-.2.7-.1l1.9.9c.3.1.5.2.5.3.1.1.1.6-.1 1.2Z";
const IN = "M5 8.5h3V19H5V8.5Zm1.5-4.7a1.7 1.7 0 1 1 0 3.5 1.7 1.7 0 0 1 0-3.5ZM10 8.5h2.9v1.4c.4-.8 1.4-1.6 3-1.6 3.1 0 3.6 2 3.6 4.7V19h-3v-5.2c0-1.2 0-2.8-1.7-2.8s-1.9 1.3-1.9 2.7V19H10V8.5Z";
const X = "M17.5 3.5h3l-6.6 7.5 7.8 9.5h-6.1l-4.8-5.9-5.4 5.9h-3l7-7.9L2.2 3.5h6.2l4.3 5.4 4.8-5.4Zm-1 15.3h1.7L7.6 5.1H5.8l10.7 13.7Z";
const FB = "M13.5 21v-7.5H16l.4-3h-2.9V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4v2.2H8v3h2.4V21h3.1Z";

export default function ShareRow({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const u = encodeURIComponent(url), t = encodeURIComponent(title);
  const open = (href: string) => window.open(href, "_blank", "noopener,noreferrer,width=640,height=600");
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" aria-label="Share on WhatsApp" onClick={() => open(`https://wa.me/?text=${t}%20${u}`)} className={`${btn} bg-[#25D366]`}><G d={WA} /></button>
      <button type="button" aria-label="Share on LinkedIn" onClick={() => open(`https://www.linkedin.com/sharing/share-offsite/?url=${u}`)} className={`${btn} bg-[#0A66C2]`}><G d={IN} /></button>
      <button type="button" aria-label="Share on X" onClick={() => open(`https://x.com/intent/post?text=${t}&url=${u}`)} className={`${btn} bg-black`}><G d={X} /></button>
      <button type="button" aria-label="Share on Facebook" onClick={() => open(`https://www.facebook.com/sharer/sharer.php?u=${u}`)} className={`${btn} bg-[#1877F2]`}><G d={FB} /></button>
      <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch {} }}
        className="flex h-10 items-center justify-center rounded-full border border-rule bg-card px-3.5 font-ui text-xs font-bold text-ink hover:border-crimson">{copied ? "Copied ✓" : "Copy link"}</button>
    </div>
  );
}
