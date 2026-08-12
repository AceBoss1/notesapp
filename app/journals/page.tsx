import JournalsGrid from "@/components/JournalsGrid";

export default function JournalsPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <span className="eyebrow">Journals</span>
      <h1 className="mt-4 max-w-2xl font-display text-4xl text-ink sm:text-5xl">
        Public writing from Precheks, read through #NotesApp
      </h1>
      <p className="mt-5 max-w-2xl text-slate">
        Same notes, same Firestore database as precheks.com.ng — this
        is the #NotesApp reading experience for that exact content,
        with a booking calendar one click away on each author's
        profile.
      </p>
      <div className="mt-12">
        <JournalsGrid />
      </div>
    </div>
  );
}
