import type { Metadata } from "next";
import { CalendarSync } from "@/components/calendar/CalendarSettings";

export const metadata: Metadata = { title: "Sync with your phone", robots: { index: false } };

// My Calendar → Sync with your phone: the private calendar link and what goes out on it (lib/my-calendar-server.ts).
export default function Page() {
  return <CalendarSync />;
}
