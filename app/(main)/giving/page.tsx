import type { Metadata } from "next";
import MyGiving from "@/components/community/MyGiving";

export const metadata: Metadata = { title: "My giving", robots: { index: false } };

// My gifts to communities, each with its receipt (lib/giving-server.ts myGifts).
export default function Page() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <p className="eyebrow">Community</p>
      <h1 className="mt-2 font-display text-4xl text-ink">My giving</h1>
      <p className="mt-2 text-sm text-slate">Every gift you&apos;ve given to a community on #NotesApp, with its receipt. Each receipt was emailed to you too.</p>
      <div className="mt-6"><MyGiving /></div>
    </div>
  );
}
