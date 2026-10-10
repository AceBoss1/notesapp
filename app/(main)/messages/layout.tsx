import Inbox from "@/components/messages/Inbox";
import MessagesBoundary from "@/components/messages/MessagesBoundary";
import { MESSAGES_LIVE } from "@/lib/moments-rules";

// On a wide screen the list of conversations stays on the left while the open conversation (or Nana) is on the right; on a phone each
// is its own page, as before.
export default function MessagesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-7xl px-4 lg:grid lg:grid-cols-[22rem,minmax(0,1fr)] lg:gap-6 lg:px-8">
      {MESSAGES_LIVE && (
        <aside className="hidden lg:block lg:py-10">
          <div className="card sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto p-4">
            <h2 className="font-display text-2xl text-ink">Messages</h2>
            <div className="mt-3"><MessagesBoundary><Inbox /></MessagesBoundary></div>
          </div>
        </aside>
      )}
      <div className="min-w-0">{children}</div>
    </div>
  );
}
