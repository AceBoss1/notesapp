// The account menu's icons (lib/account-menu.ts): one line-icon set on the 24px grid, drawn in currentColor, matching the frame's
// icons (./icons.tsx). No emoji in navigation.
import type { IconKey } from "@/lib/account-menu";

type P = { className?: string };
const S = ({ className = "h-5 w-5", children }: P & { children: React.ReactNode }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">{children}</svg>
);

const PATHS: Record<IconKey | "settings" | "upgrades" | "apps" | "chevron" | "signout" | "switch" | "plus" | "check", React.ReactNode> = {
  journal: <><path d="M5 4.5h10.5L19 8v11.5H5z" /><path d="M8.5 10h7M8.5 13.5h7M8.5 17h4" /></>,
  messages: <path d="M4 5.5h16v10H9l-5 4v-14Z" />,
  calendar: <><rect x="4" y="5.5" width="16" height="14" rx="2" /><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" /></>,
  store: <><path d="M4 9.5 5.5 5h13L20 9.5" /><path d="M4 9.5c0 1.5 1.2 2.5 2.7 2.5s2.6-1 2.6-2.5c0 1.5 1.2 2.5 2.7 2.5s2.7-1 2.7-2.5c0 1.5 1.1 2.5 2.6 2.5S20 11 20 9.5" /><path d="M5.5 12v7.5h13V12M10 19.5v-4h4v4" /></>,
  wallet: <><path d="M4 7.5h14.5a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5H5.5A1.5 1.5 0 0 1 4 18V7.5Z" /><path d="M4 7.5 15.5 4v3.5" /><circle cx="16" cy="13.5" r="1" fill="currentColor" stroke="none" /></>,
  saved: <path d="M6.5 3.5h11v17l-5.5-4-5.5 4v-17Z" />,
  bookings: <><rect x="4" y="5.5" width="16" height="14" rx="2" /><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" /><path d="m9 14.5 2 2 4-4" /></>,
  orders: <><path d="M3.5 7.5 12 3.5l8.5 4v9L12 20.5l-8.5-4v-9Z" /><path d="M3.5 7.5 12 11.5l8.5-4M12 11.5v9" /></>,
  live: <><circle cx="12" cy="12" r="2.5" /><path d="M7.5 7.5a6.4 6.4 0 0 0 0 9M16.5 7.5a6.4 6.4 0 0 1 0 9M4.6 4.6a10.5 10.5 0 0 0 0 14.8M19.4 4.6a10.5 10.5 0 0 1 0 14.8" /></>,
  tickets: <><path d="M4 7.5h16v3a1.5 1.5 0 0 0 0 3v3H4v-3a1.5 1.5 0 0 0 0-3v-3Z" /><path d="M14 7.5v9" strokeDasharray="1.5 2" /></>,
  giving: <><path d="M12 19.5s-7-4.2-7-9.2A3.8 3.8 0 0 1 12 8a3.8 3.8 0 0 1 7 2.3c0 5-7 9.2-7 9.2Z" /></>,
  shipments: <><path d="M3.5 6.5h10v9h-10zM13.5 9.5h4l3 3v3h-7" /><circle cx="7" cy="17.5" r="1.7" /><circle cx="17" cy="17.5" r="1.7" /></>,
  invites: <><circle cx="9" cy="8.5" r="3" /><path d="M3.5 19c.9-3 3-4.5 5.5-4.5s4.6 1.5 5.5 4.5M17.5 8v6M14.5 11h6" /></>,
  cycle: <><circle cx="12" cy="12" r="7.5" /><path d="M12 4.5v3M12 16.5v3M4.5 12h3M16.5 12h3" /></>,
  interests: <><path d="m12 4 2.4 5 5.3.6-4 3.6 1.1 5.3L12 15.8 7.2 18.5l1.1-5.3-4-3.6 5.3-.6L12 4Z" /></>,
  family: <><circle cx="8" cy="8" r="2.6" /><circle cx="16.5" cy="9.5" r="2" /><path d="M3.5 18.5c.7-2.8 2.4-4.2 4.5-4.2s3.8 1.4 4.5 4.2M13 18.5c.5-2 1.8-3.1 3.5-3.1s3 1.1 3.5 3.1" /></>,
  profile: <><circle cx="12" cy="8.5" r="3.8" /><path d="M4.5 20.5c1.3-3.6 4.2-5.5 7.5-5.5s6.2 1.9 7.5 5.5" /></>,
  account: <><rect x="4" y="5.5" width="16" height="13" rx="2" /><path d="m4.5 6.5 7.5 6 7.5-6" /></>,
  payouts: <><rect x="3.5" y="6.5" width="17" height="11" rx="2" /><circle cx="12" cy="12" r="2.5" /><path d="M6.5 9.5v5M17.5 9.5v5" /></>,
  org: <><path d="M4.5 20V5.5h9V20M13.5 10h6V20M3 20h18" /><path d="M7.5 9h3M7.5 12.5h3M7.5 16h3M16.5 13.5h.01M16.5 16.5h.01" /></>,
  plans: <><path d="M12 3.5 14 8l5 .5-3.7 3.4 1 4.9L12 14.4l-4.3 2.4 1-4.9L5 8.5l5-.5 2-4.5Z" /><path d="M8 20.5h8" /></>,
  badge: <><path d="m12 3.5 2.2 1.6 2.7-.1.8 2.6 2.2 1.6-.9 2.6.9 2.6-2.2 1.6-.8 2.6-2.7-.1L12 20.5l-2.2-1.6-2.7.1-.8-2.6L4.1 14.8l.9-2.6-.9-2.6 2.2-1.6.8-2.6 2.7.1L12 3.5Z" /><path d="m9 12 2 2 4-4" /></>,
  boost: <><path d="M12 20V5M6 11l6-6 6 6" /></>,
  stats: <><path d="M4 20V10M10 20V4M16 20v-7M21 20H3" /></>,
  ads: <><path d="M4 10v4h3l7 4V6l-7 4H4Z" /><path d="M17.5 9.5a3.5 3.5 0 0 1 0 5" /></>,
  nana: <><path d="M12 3.5 13.6 8 18 9.5 13.6 11 12 15.5 10.4 11 6 9.5 10.4 8 12 3.5Z" /><path d="M18 15l.8 2.2L21 18l-2.2.8L18 21l-.8-2.2L15 18l2.2-.8L18 15Z" /></>,
  help: <><circle cx="12" cy="12" r="8.5" /><path d="M9.6 9.4a2.5 2.5 0 0 1 4.8 1c0 1.7-2.4 2.2-2.4 3.6M12 17h.01" /></>,
  contact: <><path d="M4 5.5h16v10H9l-5 4v-14Z" /><path d="M12 8.5v3M12 13.5h.01" /></>,
  terms: <><path d="M6 3.5h9l3 3v14H6z" /><path d="M9 11h6M9 14.5h6M9 18h3.5" /></>,
  privacy: <><path d="M12 3.5 19 6v6c0 4.3-3 7.4-7 8.5-4-1.1-7-4.2-7-8.5V6l7-2.5Z" /><path d="m9 12 2 2 4-4" /></>,
  arcade: <><rect x="3" y="8" width="18" height="10" rx="4" /><path d="M7.5 11v4M5.5 13h4" /><circle cx="15.5" cy="12" r=".9" fill="currentColor" stroke="none" /><circle cx="17.5" cy="14.5" r=".9" fill="currentColor" stroke="none" /></>,
  life: <><path d="M3.5 20h17M5 20V10l4-3v13M9 20V5l6 3v12M15 20v-8l4 2v6" /></>,
  academy: <><path d="M1.5 9 12 4.8 22.5 9 12 13.2 1.5 9Z" /><path d="M7 11.2v4.4c0 1.4 2.2 2.6 5 2.6s5-1.2 5-2.6v-4.4" /></>,
  ventures: <><path d="M5 19c1.5-5 4.5-9.5 10-14.5 1 4-.5 8-3.5 11L8 19H5Z" /><path d="M9.5 14.5 7 12M14 8.5h.01" /></>,
  market: <><path d="M4 9h16l-1 11H5L4 9Z" /><path d="M8.5 9V7a3.5 3.5 0 0 1 7 0v2" /></>,
  explore: <><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></>,
  trending: <><path d="M4 17 10 11l4 4 6-7" /><path d="M15 8h5v5" /></>,
  exam: <><path d="M6 3.5h12v17H6z" /><path d="m9 9 1.5 1.5L13 8M9 15h6" /></>,
  community: <><circle cx="9" cy="9" r="3" /><circle cx="17" cy="10" r="2.3" /><path d="M3.5 19c.9-3 3-4.5 5.5-4.5s4.6 1.5 5.5 4.5M14.5 15.3c.7-.5 1.6-.8 2.5-.8 1.9 0 3.3 1.2 4 3.5" /></>,
  jobs: <><rect x="3.5" y="7.5" width="17" height="12" rx="2" /><path d="M9 7.5V5.5h6v2M3.5 12.5h17" /></>,
  studio: <><rect x="3" y="4.5" width="18" height="12" rx="2" /><path d="M8 20h8M12 16.5V20" /><circle cx="8" cy="10.5" r="1.6" fill="currentColor" stroke="none" /><path d="M11.5 9h6M11.5 12h4" /></>,
  link: <><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7" /></>,
  upgrades: <><rect x="4" y="4" width="7" height="7" rx="1.5" /><circle cx="16.5" cy="7.5" r="3.5" /><path d="m7.5 13.5 3.5 6.5H4l3.5-6.5Z" /><path d="M16.5 20s-3.5-2.1-3.5-4.5a1.9 1.9 0 0 1 3.5-1 1.9 1.9 0 0 1 3.5 1c0 2.4-3.5 4.5-3.5 4.5Z" /></>,
  apps: <><circle cx="5.5" cy="5.5" r="1.5" /><circle cx="12" cy="5.5" r="1.5" /><circle cx="18.5" cy="5.5" r="1.5" /><circle cx="5.5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="18.5" cy="12" r="1.5" /><circle cx="5.5" cy="18.5" r="1.5" /><circle cx="12" cy="18.5" r="1.5" /><circle cx="18.5" cy="18.5" r="1.5" /></>,
  chevron: <path d="m6 9 6 6 6-6" />,
  signout: <><path d="M14 4.5H6.5v15H14" /><path d="M10.5 12H20M16.5 8.5 20 12l-3.5 3.5" /></>,
  switch: <><path d="M7 4.5 4 7.5l3 3M4 7.5h12M17 13.5l3 3-3 3M20 16.5H8" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
};

export type AnyIcon = keyof typeof PATHS;
export function MenuGlyph({ name, className }: { name: AnyIcon; className?: string }) {
  return <S className={className}>{PATHS[name]}</S>;
}
