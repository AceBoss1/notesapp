import Link from "next/link";
import type { Metadata } from "next";
import PageHero from "@/components/PageHero";
import { CALLS_LIVE } from "@/lib/moments-rules";
import { GROUP_CALL_MAX } from "@/lib/group-calls";

export const metadata: Metadata = {
  title: "Encrypted calls",
  description: `Free voice and video calls on #NotesApp, end-to-end encrypted between your devices: one-to-one with anyone you follow who follows you back, and group calls in a group chat for up to ${GROUP_CALL_MAX.audio} people talking or ${GROUP_CALL_MAX.video} on video. Check the safety code; share your screen on a computer.`,
  alternates: { canonical: "/calls" },
};

// The footer's "Encrypted 1-on-1 calls" (#one-to-one) and "Encrypted group calls" (#group) land here. How it all works, in
// more detail, is in the help article (/help/voice-and-video-calls); the limits come from lib/group-calls.ts.
export default function CallsPage() {
  const card = "card scroll-mt-24 p-6";
  return (
    <>
      <PageHero eyebrow="Messages · Calls" title={<>Free calls, end-to-end encrypted</>}>
        <p>Talk to the people you work with, sell to and learn from, without leaving #NotesApp. Calls go straight between your devices and are encrypted end to end, so nobody in between, not even #NotesApp, can listen in. We never record them.</p>
      </PageHero>
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-12 sm:px-6 lg:px-8">
        {!CALLS_LIVE && <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-ink">Calls aren&apos;t switched on yet. This page says how they&apos;ll work.</p>}

        <section id="one-to-one" className={card}>
          <p className="eyebrow">1-on-1</p>
          <h2 className="mt-2 font-display text-2xl text-ink">Voice and video calls, one to one</h2>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-slate">
            <li>Call anyone you follow who follows you back, from your conversation with them in <Link href="/messages" className="text-crimson underline">Messages</Link>. It rings on their phone or computer, and on the installed app even when it isn&apos;t open.</li>
            <li>Switch between voice and video, front and back camera, and move or swap your own picture.</li>
            <li>On a computer, share your screen in a video call: a window, a tab or the whole screen. Phones can&apos;t share their screen.</li>
            <li>Every call leaves a line in the conversation, a missed one rings your bell, and Call back is one tap.</li>
          </ul>
        </section>

        <section id="group" className={card}>
          <p className="eyebrow">Group calls</p>
          <h2 className="mt-2 font-display text-2xl text-ink">Call the whole group</h2>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-slate">
            <li>In a group chat, tap the phone (voice) or the camera (video). Everyone in the group is rung with <strong className="text-ink">Join</strong> or <strong className="text-ink">Not now</strong>.</li>
            <li>Up to <strong className="text-ink">{GROUP_CALL_MAX.audio} people</strong> on a voice call, or <strong className="text-ink">{GROUP_CALL_MAX.video}</strong> on video. Each phone connects straight to every other one, which keeps the call encrypted and free, and is why calls are small.</li>
            <li>Missed the start? The chat shows <strong className="text-ink">Join call</strong> while someone is still in it.</li>
            <li>Bigger meetings, for many people at once, come later with <Link href="/community" className="text-crimson underline">Community</Link>.</li>
          </ul>
        </section>

        <section id="safety-code" className={card}>
          <p className="eyebrow">Check it&apos;s private</p>
          <h2 className="mt-2 font-display text-2xl text-ink">The safety code</h2>
          <p className="mt-3 text-sm text-slate">Once a call connects, tap <strong className="text-ink">🔒 End-to-end encrypted</strong> (in a group call, tap someone&apos;s picture) to see a 12-digit code. The other person sees one too: read them out to each other. If they match, the call is encrypted between your two devices and nobody in between can listen in or watch. If they don&apos;t, end the call.</p>
        </section>

        <section id="privacy" className={card}>
          <p className="eyebrow">Privacy</p>
          <h2 className="mt-2 font-display text-2xl text-ink">Who can call you, and what we keep</h2>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-slate">
            <li>Only people you follow who follow you back, and who you haven&apos;t blocked, can call you; in a group, only its members.</li>
            <li>When a network blocks a direct connection, the call passes through Cloudflare&apos;s relay, which can&apos;t listen: it only passes on what&apos;s already encrypted.</li>
            <li>We never record calls. We keep a short record (who, voice or video, when, how long, answered or missed), deleted with your account. See the <Link href="/privacy" className="text-crimson underline">Privacy Policy</Link>.</li>
          </ul>
        </section>

        <p className="text-sm text-slate">Step by step, with what to do when a call won&apos;t connect: <Link href="/help/voice-and-video-calls" className="font-semibold text-crimson">Voice and video calls in the help centre</Link>.</p>
      </div>
    </>
  );
}
