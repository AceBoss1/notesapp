import Inbox from "@/components/messages/Inbox";
import MessagesBoundary from "@/components/messages/MessagesBoundary";
import { MESSAGES_LIVE } from "@/lib/moments-rules";

// On a wide screen the list of conversations is a card on the left and the open conversation (or Nana) a card on the right, both as
// tall as the window under the site header (7.5rem: the header and the space around the cards). On a phone each is its own page,
// and an open conversation takes the whole screen.
export default function MessagesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-7xl lg:grid lg:grid-cols-[22rem,minmax(0,1fr)] lg:gap-6 lg:px-8 lg:py-6">
      {MESSAGES_LIVE && (
        <aside className="hidden lg:block">
          <div className="card flex h-[calc(100dvh-7.5rem)] flex-col overflow-hidden">
            <MessagesBoundary><Inbox /></MessagesBoundary>
          </div>
        </aside>
      )}
      <div className="min-w-0">{children}</div>
    </div>
  );
}
