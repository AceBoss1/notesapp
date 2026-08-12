import { getAllNotes } from "@/lib/firestore-notes";
import NotesGrid from "@/components/NotesGrid";

export const metadata = { title: "Notes — Precheks" };
export const dynamic = "force-dynamic";

export default async function NotesPage() {
  const notes = await getAllNotes();

  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14">
      <p className="eyebrow">Precheks Journal</p>
      <h1 className="font-display text-5xl mt-3">Notes</h1>
      <p className="mt-3 max-w-2xl text-slate font-body text-lg">
        Career clarity, data skills, and getting work right — writing from
        the Precheks team.
      </p>

      <NotesGrid notes={notes} />
    </section>
  );
}
