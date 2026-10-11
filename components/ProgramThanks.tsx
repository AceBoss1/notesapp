// A thank-you to the programmes that back #NotesApp: what each one gave us, in their own words, with their logos. Logos belong to their owners.
const GIVEN: { name: string; logo: string; round?: boolean; what: string[]; thanks: string }[] = [
  {
    name: "Claude Startups",
    logo: "/images/partners/claude.png",
    what: ["12 months of the Claude Team plan, up to $625 a month off (2-seat minimum)", "$1,000 in API credits"],
    thanks: "Thank you, Anthropic. Claude is the AI behind Nana, our helper.",
  },
  {
    name: "Moda",
    logo: "/images/partners/moda.svg",
    what: ["3 months of Moda Pro free, with up to $3,000 in AI credits"],
    thanks: "Thank you, Moda. Our new look was drawn there.",
  },
  {
    name: "Granola",
    logo: "/images/partners/granola.svg",
    round: true,
    what: ["3 months of Granola Business free, for up to 10 seats"],
    thanks: "Thank you, Granola, for the AI notepad for our team's meetings.",
  },
];

export default function ProgramThanks({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  return (
    <section className={className} aria-labelledby="thanks-h">
      <p id="thanks-h" className="eyebrow">With thanks</p>
      {!compact && <h2 className="mt-2 font-display text-2xl text-ink sm:text-3xl">Programmes that back #NotesApp</h2>}
      <p className="mt-2 max-w-2xl text-sm text-slate">We are a young company, and these programmes have given us tools and credits that let us build faster. We are grateful.</p>
      <ul className="mt-6 grid gap-4 sm:grid-cols-3">
        {GIVEN.map((g) => (
          <li key={g.name} className="card flex flex-col p-5">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={g.logo} alt="" width={44} height={44} className={`h-11 w-11 shrink-0 object-contain ${g.round ? "rounded-xl" : ""}`} />
              <p className="font-ui text-base font-bold text-ink">{g.name}</p>
            </div>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate">
              {g.what.map((w) => <li key={w}>{w}</li>)}
            </ul>
            <p className="mt-3 flex-1 text-sm font-semibold text-ink">{g.thanks}</p>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-slate">Logos and names are the property of their owners and are shown here to thank them. They do not imply endorsement.</p>
    </section>
  );
}
