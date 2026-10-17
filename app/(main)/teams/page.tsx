import Link from "next/link";
import type { Metadata } from "next";
import PageHero from "@/components/PageHero";

export const metadata: Metadata = {
  title: "Team hub and team messaging",
  description:
    "A paid add-on for Business and Enterprise after our internal testing: a shared workspace for your team with a work board, meetings, a money ledger, payroll, a staff library and team messages. Our own team is testing it now.",
};

const INSIDE = [
  { title: "A work board", body: "Every task in one place: what is moving, what is stuck, and what is waiting on a decision. A plan for today and for the week, with the overdue work first." },
  { title: "Milestones with real numbers", body: "Set a goal such as a number of members or a sales target, and watch progress against it as it happens, without anyone updating a spreadsheet." },
  { title: "A morning summary", body: "Each person gets a short note, by email and in the bell, with what is due, what is blocked and what changed overnight." },
  { title: "A weekly review", body: "The week in numbers and in work, with a place to write what went well, what you learned and what next week is about. The focus lines can turn into next week's tasks." },
  { title: "Comments on every item", body: "Talk about a task where the task is, so the decision and the reason stay together." },
  { title: "Meetings and a team room", body: "Schedule a meeting, give it its own chat room, record the decisions and turn actions into tasks. A team room keeps the everyday conversation in one place." },
  { title: "Money, payroll and a staff library", body: "A money ledger with receipts, bills and renewals with who pays them and by when, a payroll run each month, and a library for the handbook, SOPs and policies that shows who has read what." },
  { title: "Team messages", body: "A message hub for staff, with To, Cc, files and an optional email copy, next to the everyday team room." },
  { title: "Roles that fit the job", body: "People see what their job needs. Someone in customer care does not need to see payments, and finance does not need to see the support inbox." },
];

export default function TeamsPage() {
  return (
    <>
      <PageHero eyebrow="Paid add-on · Business and Enterprise · After internal testing" title={<>Team hub and team messaging</>}>
        <p>A shared workspace for the people who run your channel with you: who is doing what, what needs a decision, and a place to talk about it, all next to the journals, bookings and store you already run on #NotesApp.</p>
      </PageHero>
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">

      <section className="card mt-10 p-7" aria-labelledby="status">
        <h2 id="status" className="font-display text-2xl text-ink">Where it stands</h2>
        <p className="mt-2 text-sm text-slate">
          Our own team is using it now, every day, to run #NotesApp. We want to find what gets in the way before anyone else relies on it. Once our internal testing is done, it will be offered as a <strong className="text-ink">paid add-on for Business and Enterprise</strong>. There is no price or date yet. Nothing on this page can be switched on today, and what you get may change a little from what we use ourselves.
        </p>
      </section>

      <section className="mt-12" aria-labelledby="inside">
        <h2 id="inside" className="font-display text-2xl text-ink">What is in it</h2>
        <p className="mt-2 text-sm text-slate">This is what our team uses today. The version for your team will be shaped by what we learn.</p>
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {INSIDE.map((i) => (
            <div key={i.title} className="card p-6">
              <p className="font-ui text-base font-bold text-ink">{i.title}</p>
              <p className="mt-2 text-sm text-slate">{i.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-12" aria-labelledby="who">
        <h2 id="who" className="font-display text-2xl text-ink">Who will get it</h2>
        <p className="mt-2 text-sm text-slate">
          Business and Enterprise accounts that add it, for their team seats: four on Business (the owner and three team members), and as many as you need on Enterprise. Group chats, which anyone on #NotesApp can start, are already live, and team messaging builds on them.
        </p>
        <p className="mt-3 text-sm text-slate">
          Coming the same way, as paid add-ons for Business and Enterprise after internal testing: company finance tools (runway, acquisition cost, burn and revenue analytics, a cap table with vesting), an investor and partner data room, and advertising on LinkedIn from #NotesApp. See the <Link href="/roadmap" className="text-crimson underline underline-offset-2">roadmap</Link>.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/pricing" className="btn-primary">See plans and team seats</Link>
          <Link href="/roadmap" className="btn-ghost">Back to the roadmap</Link>
          <Link href="/contact" className="btn-ghost">Ask to hear first</Link>
        </div>
      </section>
    </div>
    </>
  );
}
