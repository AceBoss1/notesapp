// Line icons for the profile page (facts under the name, the About sections, the buttons). Same style as components/shell/icons.tsx:
// 24px grid, drawn in currentColor, 1.8 stroke.
type P = { className?: string };
const I = ({ className = "h-5 w-5", children }: P & { children: React.ReactNode }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">{children}</svg>
);

export const BriefcaseIcon = (p: P) => <I {...p}><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8.5 7V5.5A1.5 1.5 0 0 1 10 4h4a1.5 1.5 0 0 1 1.5 1.5V7" /><path d="M3 12.5h18" /></I>;
export const BuildingIcon = (p: P) => <I {...p}><path d="M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16" /><path d="M15 10h4a1 1 0 0 1 1 1v10" /><path d="M2.5 21h19" /><path d="M8 8h3M8 12h3M8 16h3" /></I>;
export const TagIcon = (p: P) => <I {...p}><path d="M3.5 12.5V4.5a1 1 0 0 1 1-1h8l8 8-9 9-8-8Z" /><circle cx="8.5" cy="8.5" r="1.3" /></I>;
export const CalendarIcon = (p: P) => <I {...p}><rect x="3.5" y="5" width="17" height="15.5" rx="2" /><path d="M3.5 10h17M8 3v4M16 3v4" /></I>;
export const UserIcon = (p: P) => <I {...p}><circle cx="12" cy="8.5" r="3.8" /><path d="M4.5 20.5c1.3-3.6 4.2-5.5 7.5-5.5s6.2 1.9 7.5 5.5" /></I>;
export const LinkIcon = (p: P) => <I {...p}><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3.2-3.2a4.5 4.5 0 0 0-6.4-6.4L11.6 6" /><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3.2 3.2a4.5 4.5 0 0 0 6.4 6.4l1.6-1.6" /></I>;
export const PencilIcon = (p: P) => <I {...p}><path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z" /><path d="m13.5 6.5 3 3" /></I>;
export const CameraIcon = (p: P) => <I {...p}><path d="M4 8h3l1.6-2.5h6.8L17 8h3a1 1 0 0 1 1 1v9.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" /><circle cx="12" cy="13.3" r="3.6" /></I>;
export const PlusIcon = (p: P) => <I {...p}><path d="M12 5v14M5 12h14" /></I>;
export const GaugeIcon = (p: P) => <I {...p}><path d="M4 18a8 8 0 1 1 16 0" /><path d="m12 14 4-5" /><circle cx="12" cy="14.5" r="1.2" fill="currentColor" stroke="none" /></I>;
export const DotsIcon = (p: P) => <I {...p}><circle cx="5.5" cy="12" r="1.3" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" /><circle cx="18.5" cy="12" r="1.3" fill="currentColor" stroke="none" /></I>;
export const TrophyIcon = (p: P) => <I {...p}><path d="M8 4h8v5a4 4 0 0 1-8 0V4Z" /><path d="M8 6H5a2.5 2.5 0 0 0 3 4M16 6h3a2.5 2.5 0 0 1-3 4" /><path d="M12 13v4M8.5 20.5h7M9.5 17h5v3.5h-5Z" /></I>;
export const ChatIcon = (p: P) => <I {...p}><path d="M4 5.5h16v10H9l-5 4v-14Z" /></I>;
export const GiftIcon = (p: P) => <I {...p}><rect x="3.5" y="8.5" width="17" height="4" rx="1" /><path d="M5 12.5v8h14v-8M12 8.5v12" /><path d="M12 8.5S10.8 4 8.4 4a2.1 2.1 0 0 0 0 4.5H12ZM12 8.5S13.2 4 15.6 4a2.1 2.1 0 0 1 0 4.5H12Z" /></I>;
export const ChevronDownIcon = (p: P) => <I {...p}><path d="m6 9.5 6 6 6-6" /></I>;
export const LiveIcon = (p: P) => <I {...p}><circle cx="12" cy="12" r="2.2" /><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M5 5a10 10 0 0 0 0 14M19 5a10 10 0 0 1 0 14" /></I>;
export const SettingsIcon = (p: P) => <I {...p}><circle cx="12" cy="12" r="3" /><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7" /></I>;
export const WalletIcon = (p: P) => <I {...p}><path d="M4 7.5h15a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7.5Z" /><path d="M4 7.5 15.5 4v3.5" /><path d="M15.5 13.8h4.5" /></I>;
