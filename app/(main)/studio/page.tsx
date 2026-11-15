import type { Metadata } from "next";
import Link from "next/link";
import StudioDemo from "@/components/studio/StudioDemo";

export const metadata: Metadata = {
  title: "Notes Live Studio",
  description: "A broadcast studio for your live on #NotesApp: your logo, a lower third, a scrolling ticker, subtitles, viewers' comments on air, intro and outro clips, and roles for your team.",
};

// /studio: what Notes Live Studio is, with the real programme picture and desk to try (nothing here is sent anywhere).
// docs/NOTES_LIVE_STUDIO.md.
export default function Page() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <p className="font-ui text-xs font-semibold uppercase tracking-eyebrow text-crimson">Notes Live Studio</p>
      <h1 className="mt-2 font-display text-4xl leading-tight text-ink sm:text-5xl">Your live, with a newsroom&apos;s finish</h1>
      <p className="mt-3 max-w-2xl text-slate">Switch the studio on in a live and everyone watching sees your logo, a lower third with the headline and the speaker&apos;s name, a scrolling ticker, subtitles and viewers&apos; comments on air. Play an intro, an outro or a clip in between. Give your team roles: an editor runs the graphics, moderators choose the comments.</p>
      <p className="mt-2 max-w-2xl text-sm text-slate">The #NotesApp team is testing it now, and it opens to everyone soon. Sending the same programme to LinkedIn Live at the same time is being built. <Link href="/lives/start" className="font-semibold text-crimson underline">Go live</Link> · <Link href="/help" className="font-semibold text-crimson underline">Help</Link></p>
      <div className="mt-8"><StudioDemo /></div>
      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
        {[
          ["Host", "Starts the live, switches the studio on, names the editors and moderators, and can do everything they can."],
          ["Editor", "Runs the picture: layout, logo, lower third, ticker, subtitles, clips and the sponsor spot."],
          ["Moderator", "Looks after the chat and puts viewers' comments on air, or lines them up in the queue."],
          ["Guest", "On stage with the host, with a microphone and, when the host allows it, a camera or a shared screen."],
          ["Viewer", "Watches, comments, likes, shares and sends gifts. A comment may be chosen for the air."],
        ].map(([t, b]) => <div key={t}><h2 className="font-ui text-sm font-bold text-ink">{t}</h2><p className="mt-1 text-sm text-slate">{b}</p></div>)}
      </div>
    </div>
  );
}
