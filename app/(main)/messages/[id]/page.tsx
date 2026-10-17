import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Thread from "@/components/messages/Thread";
import MessagesBoundary from "@/components/messages/MessagesBoundary";
import { MESSAGES_LIVE } from "@/lib/moments-rules";

export const metadata: Metadata = { title: "Messages", robots: { index: false } };

export default function ThreadPage({ params }: { params: { id: string } }) {
  if (!MESSAGES_LIVE) notFound();
  return <MessagesBoundary><Thread id={params.id} /></MessagesBoundary>;
}
