import { notFound } from "next/navigation";
import type { Metadata } from "next";
import NewGroup from "@/components/messages/NewGroup";
import MessagesBoundary from "@/components/messages/MessagesBoundary";
import { MESSAGES_LIVE } from "@/lib/moments-rules";

export const metadata: Metadata = { title: "New group", robots: { index: false } };

export default function NewGroupPage() {
  if (!MESSAGES_LIVE) notFound();
  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 lg:max-w-none lg:p-0">
      <div className="card p-5 sm:p-6 lg:h-[calc(100dvh-7.5rem)] lg:overflow-y-auto lg:p-8">
        <div className="lg:max-w-xl"><MessagesBoundary><NewGroup /></MessagesBoundary></div>
      </div>
    </div>
  );
}
