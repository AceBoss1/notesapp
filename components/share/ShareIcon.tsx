// The share icon used everywhere on #NotesApp (owner, 12 Nov 2026: "use this kind of share icon site wide"): a curved arrow leaving to the
// right, drawn as an outline in the current text colour. Every Share button opens ShareMenu, which offers Moments and Journals first.
export default function ShareIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
      <path d="M13.5 4.5 21 11.6l-7.5 7.1v-4.1c-5.2-.1-8.6 1.5-10.5 5.4.6-6 3.9-10.1 10.5-10.8V4.5Z" />
    </svg>
  );
}
