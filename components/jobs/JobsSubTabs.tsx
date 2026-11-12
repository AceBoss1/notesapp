import Link from "next/link";

// The three tabs of Jobs (Nana Jobs mockup 1): the job board on Explore, Nana Jobs, and your applications.
export default function JobsSubTabs({ active }: { active: "all" | "nana" | "applied" }) {
  const tabs = [
    { id: "all", href: "/explore?tab=jobs", label: "All jobs" },
    { id: "nana", href: "/jobs/nana", label: "🧭 Nana Jobs" },
    { id: "applied", href: "/profile/applications", label: "Applied" },
  ] as const;
  return (
    <nav aria-label="Jobs" className="flex flex-wrap gap-1.5">
      {tabs.map((t) => (
        <Link key={t.id} href={t.href} aria-current={active === t.id ? "page" : undefined}
          className={`rounded-full border px-3.5 py-1.5 font-ui text-sm font-semibold ${active === t.id ? "border-crimson bg-crimson text-paper" : "border-rule bg-card text-ink hover:border-crimson"}`}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
