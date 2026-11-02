import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getAdminDb } from "@/lib/firebase-admin";
import { publicReceipt, receiptUrl } from "@/lib/books-server";
import { methodLabel, naira, shortDate } from "@/lib/books";
import { ROOT_DOMAIN } from "@/lib/host";
import { qrSvg } from "@/lib/certificate-qr";
import PrintNow from "@/components/academy/PrintNow";
import { PrintButton } from "@/components/books/PublicBits";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Receipt", robots: { index: false } };

// A Business books receipt (lib/books-server.ts publicReceipt): an unguessable link on the main site, /receipt/<code> (/r/ is taken by
// referral links). The shop, the items, the total, how it was paid and what's still owed. Never a phone number or an email.
// ?print=1 opens the print dialog (Save as PDF); a small QR on the printed page opens this link.
export default async function ReceiptPage({ params, searchParams }: { params: { code: string }; searchParams: { print?: string } }) {
  const code = decodeURIComponent(params.code).toUpperCase();
  const r = await publicReceipt(getAdminDb(), code);
  if (!r) notFound();
  const qr = await qrSvg(receiptUrl(code));
  const when = new Date(r.at).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" });
  return (
    <main data-theme-off className="min-h-screen bg-[#FBF6F2] px-4 py-8 print:bg-white print:p-0">
      <style>{"@page { size: A5; margin: 12mm } @media print { html, body { background: #fff } }"}</style>
      <article className="mx-auto max-w-md rounded-3xl border border-[#E7DAD3] bg-white p-6 text-[#1A1210] shadow-sm print:border-0 print:shadow-none sm:p-8">
        <header className="flex items-center gap-3">
          {r.shopLogo ? <img src={r.shopLogo} alt="" className="h-12 w-12 rounded-xl object-cover" /> : <span className="grid h-12 w-12 place-items-center rounded-xl bg-[#7A0328] font-ui text-lg font-bold text-white">{r.shopName.trim()[0]?.toUpperCase()}</span>}
          <div><p className="font-ui text-lg font-bold leading-tight">{r.shopName}</p>{r.shopUsername && <p className="text-sm text-[#5C534E]">@{r.shopUsername}</p>}</div>
        </header>
        <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.14em] text-[#A6093D]">Receipt · {code.slice(0, 5)}-{code.slice(5)}</p>
        <h1 className="mt-1 font-display text-3xl">{naira(r.totalKobo)}</h1>
        <p className="text-sm text-[#5C534E]">{when}{r.customer ? ` · for ${r.customer}` : ""}</p>
        {r.voided && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">This sale was cancelled by the shop.</p>}
        <table className="mt-5 w-full text-sm">
          <tbody className="divide-y divide-[#E7DAD3]">
            {r.lines.map((l, i) => <tr key={i}><td className="py-2.5 pr-2">{l.title}{l.qty > 1 && <span className="text-[#5C534E]"> × {l.qty} at {naira(l.unitKobo)}</span>}</td><td className="py-2.5 text-right tabular-nums">{naira(l.qty * l.unitKobo)}</td></tr>)}
          </tbody>
        </table>
        <dl className="mt-3 space-y-1.5 border-t-2 border-[#1A1210] pt-3 text-[15px]">
          <div className="flex justify-between font-bold"><dt>Total</dt><dd className="tabular-nums">{naira(r.totalKobo)}</dd></div>
          <div className="flex justify-between text-[#5C534E]"><dt>Paid{r.paidKobo ? ` (${methodLabel(r.method).toLowerCase()} and since)` : ""}</dt><dd className="tabular-nums">{naira(r.paidKobo)}</dd></div>
          {r.owesKobo > 0 && <div className="flex justify-between font-semibold text-[#B45309]"><dt>Still to pay{r.dueOn ? ` by ${shortDate(r.dueOn)}` : ""}</dt><dd className="tabular-nums">{naira(r.owesKobo)}</dd></div>}
          {r.owesKobo === 0 && !r.voided && <div className="flex justify-between font-semibold text-[#3D5A45]"><dt>Paid in full</dt><dd>✓</dd></div>}
        </dl>
        <div className="mt-6 flex items-end justify-between gap-4">
          <p className="text-xs leading-relaxed text-[#5C534E]">Kept with #NotesApp Business books.<br />Keep your own books free: <Link href="/books" className="font-semibold text-[#7A0328]">{ROOT_DOMAIN}/books</Link></p>
          <div className="h-20 w-20 shrink-0" aria-label="QR code for this receipt" dangerouslySetInnerHTML={{ __html: qr }} />
        </div>
      </article>
      <div className="mx-auto mt-4 flex max-w-md justify-center print:hidden"><PrintButton /></div>
      {searchParams.print === "1" && <PrintNow />}
    </main>
  );
}
