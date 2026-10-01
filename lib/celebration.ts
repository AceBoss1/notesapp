// Independence Day + public beta celebration (Nigeria, 1 October).
// Shown automatically from START to END (Lagos dates, inclusive) — no cleanup needed.
export const CELEBRATION = {
  start: "2026-10-01",
  end: "2026-10-07",
  year: 2026,
  anniversary: 66, // independence 1960
  beta: { title: "#NotesApp public beta is open", href: "/journals/notesapp-beta-is-ready-for-you-to-try" },
};

export function celebrationActive(now = new Date()): boolean {
  const today = now.toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" }); // YYYY-MM-DD
  return today >= CELEBRATION.start && today <= CELEBRATION.end;
}
