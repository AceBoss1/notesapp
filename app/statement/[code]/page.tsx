import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getAdminDb } from "@/lib/firebase-admin";
import { publicStatement } from "@/lib/books-server";
import { naira, shortDate } from "@/lib/books";
import { ROOT_DOMAIN } from "@/lib/host";
import { StopReminders } from "@/components/books/PublicBits";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "What you owe", robots: { index: false } };

// A customer's statement (the link in a reminder): what they owe a shop and since when, with a switch to stop reminders. Only the
// customer's first name; never a phone number, another customer or the shop's profit.
export default async function StatementPage({ params }: { params: { code: string } }) {
  const code = decodeURIComponent(params.code).toUpperCase();
  const s = await publicStatement(getAdminDb(), code);
  if (!s) notFound();
  return (
    <main data-theme-off className="min-h-screen bg-[#FBF6F2] px-4 py-8">
      <article className="mx-auto max-w-md rounded-3xl border border-[#E7DAD3] bg-white p-6 text-[#1A1210] sm:p-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#A6093D]">{s.shopName}</p>
        <h1 className="mt-1 font-display text-3xl">Hello {s.customer}</h1>
        {s.owesKobo > 0 ? (
          <>
            <p className="mt-2 text-[15px] text-[#5C534E]">Here is what you owe {s.shopName}.</p>
            <p className="mt-4 font-ui text-4xl font-extrabold">{naira(s.owesKobo)}</p>
            {s.overdueKobo > 0 && <p className="text-sm font-semibold text-red-700">{naira(s.overdueKobo)} of it is past its due date</p>}
            <ul className="mt-5 divide-y divide-[#E7DAD3] text-sm">
              {s.entries.map((e, i) => <li key={i} className="flex justify-between gap-3 py-2.5"><span>{e.title}<span className="block text-xs text-[#5C534E]">{shortDate(e.on)}{e.dueOn ? ` · due ${shortDate(e.dueOn)}` : ""}</span></span><span className="font-semibold tabular-nums">{naira(e.openKobo)}</span></li>)}
            </ul>
            <p className="mt-4 rounded-xl bg-[#F3ECE7] px-3 py-2.5 text-sm text-[#5C534E]">Pay the shop the way you usually do: cash, transfer or POS. They&apos;ll mark it paid.</p>
          </>
        ) : <p className="mt-3 text-[15px] text-[#5C534E]">You don&apos;t owe {s.shopName} anything. Thank you!</p>}
        <div className="mt-5"><StopReminders code={code} off={s.remindersOff} /></div>
        <p className="mt-6 text-xs text-[#5C534E]">Sent with #NotesApp Business books. Keep your own books free: <Link href="/books" className="font-semibold text-[#7A0328]">{ROOT_DOMAIN}/books</Link></p>
      </article>
    </main>
  );
}
