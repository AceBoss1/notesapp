import type { Metadata } from "next";
import Link from "next/link";
import TeachDashboard from "@/components/academy/TeachDashboard";
import { ACADEMY_LIVE } from "@/lib/courses";

export const metadata: Metadata = { title: "Teach on Notes Academy", robots: { index: false } };

// A publisher's courses (drafts and published) and "New course". Closed while NEXT_PUBLIC_ACADEMY_LIVE=false.
export default function TeachPage() {
  if (!ACADEMY_LIVE) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-8">
        <div className="card p-6">
          <p className="font-display text-2xl text-ink">Teaching opens soon</p>
          <p className="mt-2 text-sm text-slate">Notes Academy isn&apos;t open to teachers yet. <Link href="/academy" className="font-semibold text-crimson">See what&apos;s coming</Link>.</p>
        </div>
      </div>
    );
  }
  return <TeachDashboard />;
}
