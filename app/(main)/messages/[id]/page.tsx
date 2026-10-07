import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Thread from "@/components/messages/Thread";
import { MESSAGES_LIVE } from "@/lib/moments-rules";

export const metadata: Metadata = { title: "Messages", robots: { index: false } };

export default function ThreadPage({ params }: { params: { id: string } }) {
  if (!MESSAGES_LIVE) notFound();
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <Thread id={params.id} />
    </div>
  );
}
