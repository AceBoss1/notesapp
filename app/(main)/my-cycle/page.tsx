import Link from "next/link";
import type { Metadata } from "next";
import PageHero from "@/components/PageHero";
import { CONFIDENT_AFTER, MAX_LENGTH, MIN_LENGTH } from "@/lib/cycle";

export const metadata: Metadata = {
  title: "My Cycle",
  description:
    "A private cycle and wellness companion for women and girls on #NotesApp: period predictions, a daily check-in, food and movement for each phase, and advice from Nana. Locked with your fingerprint, face or passkey, and encrypted on our server.",
};

const FEATURES = [
  { e: "🌸", t: "Today", d: "Where you are in your cycle on a ring, how long until your next period, and a short note from Nana that fits your phase and what you logged." },
  { e: "📅", t: "Calendar", d: `Logged and predicted periods. Adults also see the fertile window and the ovulation estimate, or Active and Break days in pill mode. Your cycle length is yours to set (${MIN_LENGTH} to ${MAX_LENGTH} days) or worked out from your last six cycles.` },
  { e: "📝", t: "Daily check-in", d: "Mood, symptoms, energy, pain, water, sleep and flow, plus a note only you and Nana read. Save it and Nana answers with how today fits your pattern, what to eat and how to move." },
  { e: "📈", t: "Insights", d: "Your cycle lengths, your mood through the cycle and your top symptoms, from your own history only, with Nana's monthly report." },
  { e: "🥗", t: "Food and moving by phase", d: "Our own ideas for each phase, with everyday Nigerian foods such as ugu, beans, moi moi, pap and plantain, and how much to move." },
  { e: "💬", t: "Ask Nana", d: "A private chat with Nana that knows your phase and your logs, and nothing else about you. If something needs a doctor or clinic, she says so plainly." },
];

const FAQ = [
  { q: "Who can see what I log?", a: "Only you. It is encrypted on our server, in a place no browser can read, and you open it with your passkey every time. It never goes on your profile, in ads, analytics or other Nana features, and our staff can't open it." },
  { q: "Why does it ask whether I'm female?", a: "Profiles have no gender, so the first time you open My Cycle it asks once, in private. \"Not for me\" hides it from your menu; you can undo that in Settings → Privacy." },
  { q: "Why do I need a passkey?", a: "So nobody who picks up your phone or laptop can open it. A passkey uses your fingerprint, face or screen lock, which never leaves your device. If you haven't got one, My Cycle helps you add one in a few seconds." },
  { q: "What happens when I switch apps?", a: "The page goes blank, forgets your data and locks again, so your phone's app switcher shows nothing. It also locks after 2 minutes without a touch." },
  { q: "How good are the predictions?", a: `They're estimates from your own logs, marked "early guess" until you've logged ${CONFIDENT_AFTER} periods. My Cycle is not contraception and not medical advice.` },
  { q: "I'm 13 to 17. Can I use it?", a: "Yes. The teen version has periods, symptoms, mood, food and movement, with Nana in words for your age. It has no fertile window, ovulation day or pill mode. Your parent never sees what you log. Child profiles (under 13) and organisation accounts don't have My Cycle." },
  { q: "Does Nana cost anything?", a: "Nana uses your own AI account if you've connected one, otherwise your Nana allowance, like her other help. When neither is available, you still get our own tips for your phase." },
  { q: "Can I take my data with me, or delete it?", a: "Yes: Download my data and Delete everything are in My Cycle's settings. Closing your account deletes it all too." },
];

export default function MyCycleExplainer() {
  return (
    <>
      <PageHero eyebrow="Wellness" title={<>My Cycle: private, and on your side.</>}>
        <p>A cycle and wellness companion for women and girls, with advice from Nana that fits the phase you&apos;re in. It opens only with
        your fingerprint, face or passkey, and it&apos;s encrypted on our server, so it works on any device you sign into.</p>
        <p className="small">Not contraception and not medical advice: predictions are estimates from what you log.</p>
      </PageHero>
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div key={f.t} className="card p-6">
              <span className="text-2xl" aria-hidden>{f.e}</span>
              <h2 className="mt-2 font-ui text-lg font-bold text-ink">{f.t}</h2>
              <p className="mt-2 text-sm text-slate">{f.d}</p>
            </div>
          ))}
        </div>
        <div className="card mt-10 p-7">
          <p className="font-ui text-base font-bold text-ink">🔒 Locked, every time</p>
          <p className="mt-2 text-sm text-slate">
            Opening My Cycle asks for your passkey, the same one you can use to sign in, with your fingerprint, face or screen lock. If the
            check fails, it stays locked, and the server refuses your data without a fresh unlock. Reminders are bells that only say
            &quot;A reminder from My Cycle&quot;, never an email.
          </p>
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
          <Link href="/cycle" className="btn-primary">Open My Cycle</Link>
          <Link href="/help/my-cycle" className="btn-ghost">Read the help article</Link>
          <Link href="/privacy#my-cycle" className="btn-ghost">Privacy</Link>
        </div>
      </div>
    </>
  );
}
