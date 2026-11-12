import type { Metadata } from "next";
import JobsSubTabs from "@/components/jobs/JobsSubTabs";
import NanaJobs from "@/components/jobs/NanaJobs";

export const metadata: Metadata = { title: "Nana Jobs · your daily shortlist", description: "Connect your own AI. Nana reads hundreds of openings and gives you a short ranked list, with why each fits and the strongest reason you might not get it." };

// Jobs → Nana Jobs (docs/NANA_JOBS.md): the member's own AI, a daily shortlist. The explainer for visitors is /nana-jobs.
export default function NanaJobsPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <JobsSubTabs active="nana" />
      <NanaJobs />
    </div>
  );
}
