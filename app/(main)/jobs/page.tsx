import { redirect } from "next/navigation";

// Notes Jobs lives on Explore → Jobs.
export default function JobsIndex() {
  redirect("/explore?tab=jobs");
}
