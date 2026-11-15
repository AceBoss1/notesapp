import type { Metadata } from "next";
import MyCalendar from "@/components/calendar/MyCalendar";

export const metadata: Metadata = { title: "My Calendar", robots: { index: false } };

// My Calendar (docs/MY_CALENDAR.md): the member's own calendar. Private, never indexed. The explainer is /my-calendar.
export default function Page() {
  return <MyCalendar />;
}
