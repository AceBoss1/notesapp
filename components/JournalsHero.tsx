"use client";

export type JournalsTab = "all" | "people" | "channels" | "topics";

const TABS: { id: JournalsTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "people", label: "People" },
  { id: "channels", label: "Channels" },
  { id: "topics", label: "Topics" },
];

export default function JournalsHero({
  query,
  onQueryChange,
  activeTab,
  onTabChange,
}: {
  query: string;
  onQueryChange: (v: string) => void;
  activeTab: JournalsTab;
  onTabChange: (t: JournalsTab) => void;
}) {
  return (
    <section className="border-b border-rule bg-ink py-16 text-paper">
      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
        <span className="eyebrow">Journals</span>
        <h1 className="mt-4 font-display text-4xl text-paper sm:text-5xl">
          Search People, Channels &amp; Topics
        </h1>
        <p className="mt-3 text-paper/65">
          Same notes, same Firestore database as precheks.com.ng — read
          through #NotesApp, with follow, subscribe, and a booking
          calendar one click away.
        </p>

        <div className="mt-8">
          <input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Search journals, people, topics…"
            className="w-full rounded-full border border-paper/20 bg-paper/10 px-6 py-4 text-center font-body text-paper placeholder:text-paper/50 outline-none focus:border-crimson-bright"
          />
        </div>

        <div className="mt-6 inline-flex flex-wrap justify-center gap-2 rounded-full bg-paper/10 p-1.5">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => onTabChange(t.id)}
              className={`rounded-full px-5 py-2 font-ui text-sm font-semibold transition-colors ${
                activeTab === t.id
                  ? "bg-crimson text-paper"
                  : "text-paper/70 hover:text-paper"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
