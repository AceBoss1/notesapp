import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Thread from "@/components/messages/Thread";
import { MESSAGES_LIVE } from "@/lib/moments-rules";

export const metadata: Metadata = { title: "New message", robots: { index: false } };

export default function NewMessagePage({ searchParams }: { searchParams: { to?: string } }) {
  if (!MESSAGES_LIVE || !searchParams.to) notFound();
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <Thread to={searchParams.to} />
    </div>
  );
}
