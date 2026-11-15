// "#NotesApp team" mark: shown beside the ✔ for #NotesApp staff, guest
// writers (internal roles), the official accounts and campus coordinators.
export default function TeamBadge({ size = 16 }: { size?: number }) {
  const label = "#NotesApp team — staff, campus coordinator, guest writer or official account";
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/images/brand/notesapp-icon.webp"
      alt={label}
      title={label}
      width={size}
      height={size}
      className="ml-0.5 inline-block flex-shrink-0 rounded-[4px] align-middle"
      style={{ width: size, height: size }}
    />
  );
}

// The campus ambassador mark (owner, 15 Nov 2026: "an inversed white badge with maroon shadow"): the team mark turned inside out, a white
// tile with the maroon "na" and a maroon shadow. Campus Leads wear it too.
export function CampusBadge({ size = 16, lead = false }: { size?: number; lead?: boolean }) {
  const label = lead ? "#NotesApp Campus Lead" : "#NotesApp campus ambassador";
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} role="img" aria-label={label} className="ml-0.5 inline-block flex-shrink-0 align-middle" style={{ width: size, height: size, overflow: "visible", filter: "drop-shadow(0 1px 1.4px rgba(122, 3, 40, 0.75))" }}>
      <title>{label}</title>
      <rect x="1" y="1" width="30" height="30" rx="8" fill="#FFFFFF" stroke="#7A0328" strokeOpacity="0.35" strokeWidth="1" />
      <text x="16" y="21.5" textAnchor="middle" fontFamily="Inter, Arial, Helvetica, sans-serif" fontWeight="800" fontSize="17" letterSpacing="-0.6" fill="#7A0328">na</text>
    </svg>
  );
}
