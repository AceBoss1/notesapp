import { lastSeenLabel, type PresenceStatus } from "@/lib/social-graph";

// "@ada · Online" (online in green) or "@ada · Last seen 2:05 PM"; just the handle when their status isn't shown to you.
export default function HandleLine({ username, status, className = "" }: { username?: string; status?: PresenceStatus; className?: string }) {
  return (
    <span className={`block truncate ${className}`}>
      {username ? `@${username}` : ""}
      {status && <>{username ? " · " : ""}<span className={status.online ? "font-semibold text-green-700" : ""}>{lastSeenLabel(status)}</span></>}
    </span>
  );
}
