// Small inline icons for contact lines (inherit the text colour).
const base = { width: 16, height: 16, viewBox: "0 0 24 24", "aria-hidden": true, className: "inline-block h-4 w-4 shrink-0" } as const;

export const MailIcon = () => (
  <svg {...base} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3 7l9 6 9-6" />
  </svg>
);

export const LinkedInIcon = () => (
  <svg {...base} fill="currentColor">
    <path d="M4.98 3.5a2.5 2.5 0 11-.02 5 2.5 2.5 0 01.02-5zM3 9.75h4v11.25H3zM9.5 9.75h3.8v1.54h.05c.53-1 1.82-2.05 3.75-2.05 4 0 4.75 2.63 4.75 6.05V21h-4v-5.1c0-1.22-.02-2.78-1.7-2.78-1.7 0-1.96 1.33-1.96 2.69V21h-4z" />
  </svg>
);

export const FacebookIcon = () => (
  <svg {...base} fill="currentColor">
    <path d="M13.5 21v-8h2.7l.4-3.2h-3.1V7.8c0-.9.25-1.5 1.55-1.5h1.65V3.4c-.3 0-1.25-.1-2.4-.1-2.4 0-4.05 1.45-4.05 4.15v2.35H7.5V13h2.75v8z" />
  </svg>
);

// eslint-disable-next-line @next/next/no-img-element
export const NotesAppIcon = () => <img src="/images/brand/notesapp-icon.webp" alt="" width={16} height={16} className="inline-block h-4 w-4 shrink-0 rounded" />;
