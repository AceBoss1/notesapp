import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Thread from "@/components/messages/Thread";
import MessagesBoundary from "@/components/messages/MessagesBoundary";
import { MESSAGES_LIVE } from "@/lib/moments-rules";

export const metadata: Metadata = { title: "New message", robots: { index: false } };

export default function NewMessagePage({ searchParams }: { searchParams: { to?: string } }) {
  if (!MESSAGES_LIVE || !searchParams.to) notFound();
  return <MessagesBoundary><Thread to={searchParams.to} /></MessagesBoundary>;
}
