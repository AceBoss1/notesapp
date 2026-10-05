// Small inline icons for contact and social lines (they inherit the text colour).
type IconProps = { size?: number };
const svg = (size: number) => ({ width: size, height: size, viewBox: "0 0 24 24", "aria-hidden": true, className: "inline-block shrink-0", style: { width: size, height: size } }) as const;

export const MailIcon = ({ size = 16 }: IconProps) => (
  <svg {...svg(size)} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3 7l9 6 9-6" />
  </svg>
);

export const LinkedInIcon = ({ size = 16 }: IconProps) => (
  <svg {...svg(size)} fill="currentColor">
    <path d="M4.98 3.5a2.5 2.5 0 11-.02 5 2.5 2.5 0 01.02-5zM3 9.75h4v11.25H3zM9.5 9.75h3.8v1.54h.05c.53-1 1.82-2.05 3.75-2.05 4 0 4.75 2.63 4.75 6.05V21h-4v-5.1c0-1.22-.02-2.78-1.7-2.78-1.7 0-1.96 1.33-1.96 2.69V21h-4z" />
  </svg>
);

export const FacebookIcon = ({ size = 16 }: IconProps) => (
  <svg {...svg(size)} fill="currentColor">
    <path d="M13.5 21v-8h2.7l.4-3.2h-3.1V7.8c0-.9.25-1.5 1.55-1.5h1.65V3.4c-.3 0-1.25-.1-2.4-.1-2.4 0-4.05 1.45-4.05 4.15v2.35H7.5V13h2.75v8z" />
  </svg>
);

export const InstagramIcon = ({ size = 16 }: IconProps) => (
  <svg {...svg(size)} fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.5" cy="6.5" r="1.1" fill="currentColor" stroke="none" />
  </svg>
);

export const XIcon = ({ size = 16 }: IconProps) => (
  <svg {...svg(size)} fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

export const WhatsAppIcon = ({ size = 16 }: IconProps) => (
  <svg {...svg(size)} fill="currentColor">
    <path d="M12 2a10 10 0 00-8.6 15.1L2 22l5-1.3A10 10 0 1012 2zm0 18.2a8.2 8.2 0 01-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1112 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 01-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.5l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 00-.7.3 3 3 0 00-.9 2.2 5.2 5.2 0 001.1 2.8c.1.2 2 3 4.9 4.2 1.8.8 2.5.8 3.4.7.6-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.6-.3z" />
  </svg>
);

export const TikTokIcon = ({ size = 16 }: IconProps) => (
  <svg {...svg(size)} fill="currentColor">
    <path d="M16.6 5.8A4.3 4.3 0 0115.5 3h-3.1v12.4a2.6 2.6 0 11-1.8-2.5V9.7a5.7 5.7 0 105 5.7V9a7.3 7.3 0 004.2 1.3V7.2a4.3 4.3 0 01-3.2-1.4z" />
  </svg>
);

export const GlobeIcon = ({ size = 16 }: IconProps) => (
  <svg {...svg(size)} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18" />
  </svg>
);

// eslint-disable-next-line @next/next/no-img-element
export const NotesAppIcon = ({ size = 16 }: IconProps) => <img src="/images/brand/notesapp-icon.webp" alt="" width={size} height={size} className="inline-block shrink-0 rounded" style={{ width: size, height: size }} />;
