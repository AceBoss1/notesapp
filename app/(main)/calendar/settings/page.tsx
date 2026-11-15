import type { Metadata } from "next";
import { CalendarReminders } from "@/components/calendar/CalendarSettings";

export const metadata: Metadata = { title: "Calendar settings", robots: { index: false } };

// My Calendar → Settings: reminder bells, the Monday week-ahead email, times, and what's coming later.
export default function Page() {
  return <CalendarReminders />;
}
