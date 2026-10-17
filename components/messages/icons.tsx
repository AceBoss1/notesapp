// The small line icons used across Messages (stroke follows the text colour).
type P = { size?: number; className?: string };
const line = { fill: "none", stroke: "currentColor", strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };

export function PhoneIcon({ size = 20, className = "" }: P) {
  return <svg width={size} height={size} viewBox="0 0 24 24" strokeWidth="1.7" className={className} {...line}><path d="M5 4h3.2l1.6 4-2 1.3a11 11 0 006 6l1.3-2 4 1.6V18a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z" /></svg>;
}

export function VideoIcon({ size = 22, className = "" }: P) {
  return <svg width={size} height={size} viewBox="0 0 24 24" strokeWidth="1.7" className={className} {...line}><rect x="2.5" y="6" width="13" height="12" rx="1.5" /><path d="M15.5 10.5l6-3.5v10l-6-3.5" /></svg>;
}

export function DotsIcon({ size = 20, className = "" }: P) {
  return <svg width={size} height={size} viewBox="0 0 24 24" strokeWidth="1.7" className={className} {...line}><circle cx="12" cy="5" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="12" cy="19" r="1.6" /></svg>;
}

export function ChevronIcon({ size = 16, dir = "down", className = "" }: P & { dir?: "down" | "left" }) {
  return <svg width={size} height={size} viewBox="0 0 20 20" strokeWidth="2" className={className} {...line}><path d={dir === "left" ? "M12.5 4l-6 6 6 6" : "M5 8l5 5 5-5"} /></svg>;
}

export function SendIcon({ size = 22, className = "" }: P) {
  return <svg width={size} height={size} viewBox="0 0 24 24" strokeWidth="1.8" className={className} {...line}><path d="M4 4l17 8-17 8 3-8-3-8z" /><path d="M7 12h14" /></svg>;
}

export function CheckIcon({ size = 22, className = "" }: P) {
  return <svg width={size} height={size} viewBox="0 0 24 24" strokeWidth="2" className={className} {...line}><path d="M5 12.5l4.5 4.5L19 7" /></svg>;
}

export function PinIcon({ size = 16, className = "" }: P) {
  return <svg width={size} height={size} viewBox="0 0 24 24" strokeWidth="1.7" className={className} {...line}><path d="M14.5 3.5l6 6-2.2.8-3.6 3.6.3 4.1-1.5 1.5-4-4-5 5M9.5 14.5l-4-4L7 9l4.1.3 3.6-3.6z" /></svg>;
}

// ✓ sent, ✓✓ read.
export function TickIcon({ read = false, className = "" }: { read?: boolean; className?: string }) {
  return (
    <svg width={read ? 16 : 11} height="11" viewBox={read ? "0 0 16 11" : "0 0 11 11"} strokeWidth="1.5" className={`inline-block ${className}`} {...line}>
      <path d="M1 6l3 3 6-7" />
      {read && <path d="M7.5 8.5l.5.5 6-7" />}
    </svg>
  );
}
