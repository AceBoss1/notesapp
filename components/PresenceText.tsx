import { lastSeenLabel, type PresenceStatus } from "@/lib/social-graph";

// "● Online" in green, or "Last seen …" in grey. Nothing when the viewer may not see this person's status.
export default function PresenceText({ status, className = "" }: { status: PresenceStatus | undefined; className?: string }) {
  if (!status) return null;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs ${status.online ? "font-semibold text-green-700" : "text-slate"} ${className}`}>
      <span aria-hidden="true" className={`inline-block h-2 w-2 rounded-full ${status.online ? "bg-green-600" : "bg-rule"}`} />
      {lastSeenLabel(status)}
    </span>
  );
}
