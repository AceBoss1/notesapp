// Line icons for Moments, from the owner's "Moments Redesign" (Moda, 16 Nov 2026). 24px grid, 1.6 stroke, the current colour.
type P = { size?: number; className?: string };
const S = ({ size = 22, className, children }: P & { children: React.ReactNode }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>{children}</svg>
);
export const IconScissors = (p: P) => <S {...p}><circle cx="6" cy="6.5" r="2.5" /><circle cx="6" cy="17.5" r="2.5" /><path d="M8.2 7.8 20 16.5M8.2 16.2 20 7.5" /></S>;
export const IconCc = (p: P) => <S {...p}><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M10.5 10.5a2 2 0 1 0 0 3M17 10.5a2 2 0 1 0 0 3" /></S>;
export const IconNote = (p: P) => <S {...p}><path d="M5 4h10l4 4v12H5z" /><path d="M8 9h5M8 13h8M8 17h6" /></S>;
export const IconMusic = (p: P) => <S {...p}><path d="M9 18V6l10-2v12" /><circle cx="6.5" cy="18" r="2.5" /><circle cx="16.5" cy="16" r="2.5" /></S>;
export const IconTimer = (p: P) => <S {...p}><circle cx="12" cy="13.5" r="7" /><path d="M12 10v3.5l2.2 1.6M9.5 3h5" /></S>;
export const IconMic = (p: P) => <S {...p}><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3" /></S>;
export const IconChevron = (p: P) => <S {...p}><path d="m9 6 6 6-6 6" /></S>;
export const IconBack = (p: P) => <S {...p}><path d="M20 12H4m6-6-6 6 6 6" /></S>;
export const IconClose = (p: P) => <S {...p}><path d="M6 6l12 12M18 6 6 18" /></S>;
export const IconPlay = (p: P) => <S {...p}><path d="M8 5.5v13l11-6.5z" /></S>;
export const IconSound = (p: P) => <S {...p}><path d="M4 10v4h3l5 4V6l-5 4z" /><path d="M16 9.5a4 4 0 0 1 0 5" /></S>;
export const IconEye = (p: P) => <S {...p}><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="2.8" /></S>;
export const IconHeart = (p: P) => <S {...p}><path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.5 2.5C19 15.4 12 20 12 20z" /></S>;
export const IconRepost = (p: P) => <S {...p}><path d="M7 7h10l-2-2M17 17H7l2 2M17 7v5M7 17v-5" /></S>;
