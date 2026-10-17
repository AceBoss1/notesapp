// Line icons for the frame (header, bottom tabs, sidebar). 24px grid, drawn in currentColor.
type P = { className?: string };
const I = ({ className = "h-6 w-6", children }: P & { children: React.ReactNode }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">{children}</svg>
);

export const HomeIcon = (p: P) => <I {...p}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /></I>;
export const ExploreIcon = (p: P) => <I {...p}><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></I>;
export const TrendingIcon = (p: P) => <I {...p}><path d="M4 17 10 11l4 4 6-7" /><path d="M15 8h5v5" /></I>;
export const MarketIcon = (p: P) => <I {...p}><path d="M4 9h16l-1 11H5L4 9Z" /><path d="M8.5 9V7a3.5 3.5 0 0 1 7 0v2" /></I>;
export const AcademyIcon = (p: P) => <I {...p}><path d="m2.5 9 9.5-4.5L21.5 9 12 13.5 2.5 9Z" /><path d="M6.5 11v4.5c0 1.4 2.5 3 5.5 3s5.5-1.6 5.5-3V11" /><path d="M21.5 9v5" /></I>;
export const MessagesIcon = (p: P) => <I {...p}><path d="M4 5.5h16v10H9l-5 4v-14Z" /></I>;
export const SavedIcon = (p: P) => <I {...p}><path d="M6.5 3.5h11v17l-5.5-4-5.5 4v-17Z" /></I>;
export const ProfileIcon = (p: P) => <I {...p}><circle cx="12" cy="8.5" r="3.8" /><path d="M4.5 20.5c1.3-3.6 4.2-5.5 7.5-5.5s6.2 1.9 7.5 5.5" /></I>;
export const BellIcon = (p: P) => <I {...p}><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15l1.5-2Z" /><path d="M10 20.5a2 2 0 0 0 4 0" /></I>;
export const PenIcon = (p: P) => <I {...p}><path d="m14.5 5.5 4 4L8 20H4v-4L14.5 5.5Z" /><path d="m12.5 7.5 4 4" /></I>;
export const MenuIcon = (p: P) => <I {...p}><path d="M4 7h16M4 12h16M4 17h16" /></I>;
export const CloseIcon = (p: P) => <I {...p}><path d="M6 6l12 12M18 6 6 18" /></I>;
