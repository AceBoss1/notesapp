import Link from "next/link";
import type { Metadata } from "next";
import PageHero from "@/components/PageHero";
import { getAdminDb } from "@/lib/firebase-admin";
import { openRoles } from "@/lib/careers-server";
import { ARRANGEMENT_LABEL, type CareerRole } from "@/lib/careers";
import { DEPT_LABEL } from "@/lib/admin-access";

export const metadata: Metadata = {
  title: "Careers",
  description: "Work at #NotesApp: open roles across Nigeria, remote. Help Africa's creators, teachers, professionals and businesses share what they know and get paid for it.",
};
export const revalidate = 60;

// The public careers page: the roles a super admin has opened in the team hub (Nana-HR & hiring). Applying needs a NotesApp account.
export default async function CareersPage() {
  let roles: CareerRole[] = [];
  try { roles = await openRoles(getAdminDb()); } catch { roles = []; }
  return (
    <>
      <PageHero eyebrow="Company / Careers" title={<>Work at #NotesApp</>}>
        <p>We&apos;re building one home for Africa&apos;s creators, teachers, professionals and businesses to share what they know and get paid for it, in naira. We work remotely across Nigeria, on our own tools, and we write things down.</p>
      </PageHero>
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <h2 className="font-display text-3xl text-ink">Open roles</h2>
        {roles.length === 0 ? (
          <p className="mt-4 text-slate">No open roles right now. Follow <Link href="/u/notesapp" className="text-crimson underline">#NotesApp</Link> to hear when there are.</p>
        ) : (
          <ul className="mt-6 space-y-4">
            {roles.map((r) => (
              <li key={r.id} className="card p-6">
                <p className="eyebrow">{DEPT_LABEL[r.dept]}</p>
                <h3 className="mt-1 font-display text-2xl text-ink"><Link href={`/careers/${r.id}`} className="hover:text-crimson">{r.title}</Link></h3>
                {r.summary && <p className="mt-2 text-slate">{r.summary}</p>}
                <p className="mt-3 text-sm text-ink">{r.location} · {r.hours} · {ARRANGEMENT_LABEL[r.arrangement]}</p>
                <Link href={`/careers/${r.id}`} className="mt-4 inline-block rounded-full bg-crimson px-5 py-2 font-ui text-sm font-semibold text-paper">See the role and apply</Link>
              </li>
            ))}
          </ul>
        )}
        <section className="mt-12 grid gap-6 sm:grid-cols-3">
          <div><h3 className="font-display text-xl text-ink">How we hire</h3><p className="mt-2 text-sm text-slate">A person reads every application. Nana-HR, our AI helper, checks it against the role&apos;s stated requirements; she never ranks or rejects anyone. Interviews are on NotesApp calls.</p></div>
          <div><h3 className="font-display text-xl text-ink">How we work</h3><p className="mt-2 text-sm text-slate">Remote across Nigeria, usually 20 hours a week, Monday to Friday. Hours are tracked in our team hub, with no screenshots and no keystroke logging.</p></div>
          <div><h3 className="font-display text-xl text-ink">You&apos;ll hear back</h3><p className="mt-2 text-sm text-slate">Every applicant hears from us, yes or no. Your application is deleted 6 months after the role closes, unless you ask us to keep it.</p></div>
        </section>
      </div>
    </>
  );
}
