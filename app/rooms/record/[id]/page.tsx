import type { Metadata } from "next";
import RecorderPage from "./RecorderPage";

// The hidden page the room recorder (services/room-recorder) opens in headless Chromium. Not for people: it has no links in, isn't
// indexed, and does nothing without the room token the server gave the recorder (receive-only, one room, short-lived).
export const metadata: Metadata = { title: "Recorder", robots: { index: false, follow: false } };
export default function Page({ params, searchParams }: { params: { id: string }; searchParams: { token?: string } }) {
  return <RecorderPage roomId={params.id} token={String(searchParams.token ?? "")} />;
}
