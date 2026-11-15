import Link from "next/link";
import type { Metadata } from "next";
import PageHero from "@/components/PageHero";
import RulesCard from "@/components/content-checks/RulesCard";

export const metadata: Metadata = {
  title: "Content rules",
  description:
    "Every photo, video frame and text that other people can see on #NotesApp is checked by AI before it is published. What isn't allowed, what happens when a post breaks the rules, strikes and appeals.",
};

// The public page for AI content checks (docs/CONTENT_CHECKS.md). No figures: how many strikes, and for how long, are set in Admin.
const WHERE = ["Journals", "Community posts and comments", "Moments", "Media posts", "Shop items", "Events", "Your profile's name, bio and pictures"];
const FAQ = [
  { q: "Are my private messages read?", a: "No. Private one-to-one and group messages are not checked. Everything else that people other than you can see is: public, followers-only and subscriber-only posts alike." },
  { q: "Why are subscriber-only posts checked too?", a: "Our payment partners and the app stores can see paid content, and they forbid sexual content, so the same rules apply everywhere." },
  { q: "What about news, medical posts and art?", a: "They are judged in context. When our check isn't sure, a person on our Trust & safety team looks before anything is blocked, and it isn't a strike." },
  { q: "What happens if my post breaks the rules?", a: "It isn't published, and nobody sees it. It stays as a draft, and we tell you what was found and in which photo, so you can remove it and post again." },
  { q: "What is a strike?", a: "Each post that breaks the rules is a strike. Too many in a short time and posting is paused for a while: you can still read and message. A further strike after that closes the account. Strikes clear after a while." },
  { q: "Can I appeal?", a: "Yes, every strike. Tap Ask for a review, or appeal from your account page. A person decides within 48 hours; if they restore your post, it is published and the strike is removed." },
  { q: "When is a community closed?", a: "Only when its owner or moderators keep posting or approving content that breaks the rules. Members are warned first, and the owner can appeal." },
  { q: "Child safety", a: "Child sexual abuse material closes the account at once and for good, and we report it to the authorities." },
  { q: "What if the check is down?", a: "We don't stop you posting. Your post goes up and is checked as soon as the check is back; if it breaks the rules then, it is taken down." },
];

export default function ContentRulesPage() {
  return (
    <>
      <PageHero eyebrow="Trust & safety" title={<>Content rules: checked before it&apos;s published.</>}>
        <p>Every photo, video frame and text that other people can see on #NotesApp is checked by AI before it is published. Private messages are not read.</p>
      </PageHero>
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          <RulesCard more={false} />
          <div className="card p-6">
            <p className="font-ui text-base font-bold text-ink">What is checked</p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate">{WHERE.map((w) => <li key={w}>{w}</li>)}</ul>
            <p className="mt-4 text-sm text-slate">Checking takes a second or two while you post. Only new or changed text and pictures are checked.</p>
          </div>
        </div>
        <div className="mt-12">
          <p className="eyebrow">Questions</p>
          <dl className="mt-4 divide-y divide-rule border-y border-rule">
            {FAQ.map((f) => (
              <div key={f.q} className="py-4">
                <dt className="font-ui text-sm font-bold text-ink">{f.q}</dt>
                <dd className="mt-1 text-sm text-slate">{f.a}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/profile/account#content-checks" className="btn-primary">Your strikes and appeals</Link>
          <Link href="/help/content-checks" className="btn-ghost">Read the help article</Link>
          <Link href="/terms#content-checks" className="btn-ghost">Terms, section 2e</Link>
        </div>
      </div>
    </>
  );
}
