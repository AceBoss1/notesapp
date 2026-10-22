"use client";
import Link from "next/link";
import { usePrepHref } from "@/lib/exam-prep-client";

export { C, card, btn, btnGo, btnNavy, btnLine, btnGold, input } from "./styles";

export function PLink({ href, className, children, onClick, ...rest }: { href: string; className?: string; children: React.ReactNode } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">) {
  const h = usePrepHref();
  const to = h(href);
  return <Link href={to} className={className} onClick={(e) => { onClick?.(e); if (!e.defaultPrevented && !navigator.onLine && !to.startsWith("#")) { e.preventDefault(); window.location.assign(to); } }} {...rest}>{children}</Link>;
}
export function Pill({ children, tone = "navy" }: { children: React.ReactNode; tone?: "navy" | "green" | "gold" | "grey" }) {
  const t = { navy: "bg-[#0F2747]/10 text-[#0F2747]", green: "bg-[#1E8E5A]/12 text-[#146b43]", gold: "bg-[#C9A227]/20 text-[#7a6114]", grey: "bg-black/5 text-black/60" }[tone];
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${t}`}>{children}</span>;
}
export function Note({ children, tone = "info" }: { children: React.ReactNode; tone?: "info" | "error" | "ok" }) {
  const t = { info: "border-[#0F2747]/15 bg-[#0F2747]/5 text-[#0F2747]", error: "border-[#B3261E]/30 bg-[#B3261E]/5 text-[#8c1d17]", ok: "border-[#1E8E5A]/30 bg-[#1E8E5A]/8 text-[#146b43]" }[tone];
  return <div role={tone === "error" ? "alert" : "status"} className={`rounded-xl border px-3 py-2 text-sm ${t}`}>{children}</div>;
}
export function Back({ href, children }: { href: string; children: React.ReactNode }) {
  return <PLink href={href} className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-[#0F2747]/70 hover:text-[#0F2747]">← {children}</PLink>;
}
export function Spinner({ label = "Loading…" }: { label?: string }) {
  return <p className="py-10 text-center text-sm text-[#0F2747]/60">{label}</p>;
}
