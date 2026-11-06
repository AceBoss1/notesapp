import Link from "next/link";
import { JOB_TYPE_LABEL, payText, placeText, type Job } from "@/lib/jobs";

// One job in a list (Explore → Jobs, a firm's list): title, firm, where, type and pay, and why it fits when we know.
export default function JobCard({ job, reasons }: { job: Job; reasons?: string[] }) {
  const pay = payText(job);
  return (
    <Link href={`/jobs/${job.id}`} className="card block p-5 hover:border-crimson">
      <p className="font-ui text-xs font-semibold uppercase tracking-wide text-crimson">{job.orgName}</p>
      <p className="mt-1 font-display text-xl text-ink">{job.title}</p>
      <p className="mt-1 text-sm text-slate">{placeText(job)} · {JOB_TYPE_LABEL[job.type]}{pay ? ` · ${pay}` : ""}</p>
      <p className="mt-2 line-clamp-2 text-sm text-ink">{job.summary}</p>
      {reasons && reasons.length > 0 && <p className="mt-2 text-xs text-green-800">Fits you: {reasons.join(" · ")}</p>}
    </Link>
  );
}
