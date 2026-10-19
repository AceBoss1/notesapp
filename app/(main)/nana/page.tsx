import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import NanaConnect from "@/components/NanaConnect";
import NanaPanel from "@/components/NanaPanel";
import { NanaAllowance } from "@/components/NanaGems";
import { nanaConfigured } from "@/lib/nana-config";

export const metadata: Metadata = {
  title: "Nana AI",
  description: "Meet Nana, #NotesApp's helper: ask her anything about the platform and get answers with links, get writing help for drafts, sharing and messages, topic suggestions, chat summaries and translations, with a free weekly allowance on every plan and Nana credit to top it up.",
};
export const revalidate = 3600; // static text; nanaConfigured() is checked again each hour

const DOES = [
  { title: "Answers, with links", body: "Ask about plans and prices, payouts, bookings and refunds, selling, badges, organisations. She answers in plain words and links you to the right page. Her answers come from our help centre, which our team writes and keeps right." },
  { title: "Writing help in your drafts", body: "In the journal composer, ask Nana to improve, shorten or expand your writing, make it friendlier or more professional, or turn rough notes into a first draft." },
  { title: "Posts for LinkedIn and X", body: "When you share a post, ask Nana to write the words for LinkedIn or X, and edit them before anything goes out." },
  { title: "Help with messages", body: "In a conversation, ask Nana to suggest a reply or polish what you wrote. You always read and send it yourself. Summarise tells you what you missed in a busy chat, and Translate puts a message into English, Pidgin, Yorùbá, Igbo or Hausa." },
  { title: "Topics from your title", body: "Type a journal's or course's title and Nana suggests topics and subtopics to tap; for a Market item, its category and subcategory. Free, and not taken from your allowance." },
  { title: "Gems, allowance and credit", body: "Choose Pearl (fast, every plan), Emerald (deeper, Business and Enterprise) or Ruby (our most capable, Enterprise), and how long she thinks. Every plan has a free allowance that refreshes weekly; Nana credit tops it up and never expires. A general question asked before is answered free from her answer bank." },
  { title: "In the team hub", body: "Our own team asks Nana what to focus on and how the admin tools work. She comes with the Team hub, which will be a paid add-on for Business and Enterprise after our internal testing." },
];

export default function NanaPage() {
  const ai = nanaConfigured();
  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="flex flex-col items-center gap-8 md:flex-row">
        <Image src="/images/nana/nana.webp" alt="Nana, the #NotesApp helper robot" width={220} height={220} priority className="h-44 w-44 shrink-0 md:h-56 md:w-56" />
        <div>
          <span className="eyebrow">Nana AI</span>
          <h1 className="mt-3 font-display text-4xl text-ink sm:text-5xl">Meet Nana, your #NotesApp helper</h1>
          <p className="mt-4 max-w-2xl text-lg text-slate">Ask her anything about the platform. She replies like a person, links you to the right page, helps with your writing, and passes you to our team when she can&apos;t help.</p>
        </div>
      </div>

      <section className="mt-12 grid gap-8 lg:grid-cols-2" aria-label="Chat with Nana">
        <div className="overflow-hidden rounded-xl border border-rule"><NanaPanel context="page" autoFocus={false} className="h-[560px]" /></div>
        <div>
          <h2 className="font-display text-2xl text-ink">What Nana can do</h2>
          <ul className="mt-4 space-y-3">
            {DOES.map((d) => <li key={d.title} className="card p-4"><p className="font-ui text-sm font-bold text-ink">{d.title}</p><p className="mt-1 text-sm text-slate">{d.body}</p></li>)}
          </ul>
        </div>
      </section>

      <section className="mt-14" aria-labelledby="modes">
        <h2 id="modes" className="font-display text-2xl text-ink">Two ways Nana works</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="card p-5"><p className="font-ui text-sm font-bold text-ink">From the help centre</p><p className="mt-1 text-sm text-slate">Always on. Nana finds the best help articles for your question and walks you through them, with links. She can&apos;t write for you in this mode.</p></div>
          <div className="card p-5"><p className="font-ui text-sm font-bold text-ink">With AI</p><p className="mt-1 text-sm text-slate">Nana holds a real conversation, combines what she knows, and gives the writing help above. If the AI is ever unavailable, she carries on from the help centre.</p></div>
        </div>
        <p className="mt-4 rounded-lg border border-rule bg-card p-4 text-sm text-ink">
          {ai ? "Right now: the AI is switched on for everyone. Every member gets a free allowance, sized by plan and refreshed regularly, because we pay for it; Nana credit tops it up. Connect your own AI account below and there is no limit from us at all." : "Right now: Nana answers from the help centre for everyone. To switch the full version on for yourself today, connect your own AI account below. When we switch our own AI on for everyone, it works without it."}
        </p>
      </section>

      <section id="credit" className="mt-14 scroll-mt-24" aria-labelledby="gems">
        <h2 id="gems" className="font-display text-2xl text-ink">Pearl, Emerald and Ruby</h2>
        <p className="mt-2 max-w-3xl text-sm text-slate">Nana runs on three models, named after gems: the dearer the gem, the more capable the model. Everyone has Pearl. Business adds Emerald, and Enterprise adds Ruby; choose in the chat, next to Nana&apos;s name. Your free allowance refreshes on a timer and doesn't carry over; Nana credit you buy does, and is used once the allowance runs out.</p>
        <div className="mt-5"><NanaAllowance /></div>
      </section>

      <section className="mt-14" aria-labelledby="connect">
        <h2 id="connect" className="font-display text-2xl text-ink">Connect your own AI account</h2>
        <p className="mt-2 max-w-3xl text-sm text-slate">Use your own Anthropic account to power Nana in your chats, drafts, shares and messages, and in the team hub for staff. The AI cost goes to your account, you can set a spending limit with Anthropic, and #NotesApp puts no daily limit on you. Your text is sent to Anthropic to write the answer; we don&apos;t keep the text you send for writing help. We store your key encrypted and delete it when you disconnect or delete your account. See the <Link href="/privacy" className="underline">Privacy Policy</Link>.</p>
        <div className="mt-5 max-w-xl"><NanaConnect /></div>
      </section>

      <p className="mt-14 text-sm text-slate">Looking for articles instead? Browse the <Link href="/help" className="text-crimson underline">help centre</Link>, or <Link href="/contact" className="text-crimson underline">contact the team</Link>.</p>
    </div>
  );
}
