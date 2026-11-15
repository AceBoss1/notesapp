import Link from "next/link";

// The rules, where people post (AI content checks, docs/CONTENT_CHECKS.md): each community's About tab, the journal editor, the Media
// studio, the Terms and /content-rules. No figures here: how many strikes and for how long are set in Admin, and help text never prints them.
const RULES = [
  { icon: "🔒", bg: "bg-[#E0123E]", title: "Photos and videos are checked by AI", text: "Sexual content, gore, violence, self-harm, drugs, weapons, hate or extremism are not published." },
  { icon: "💬", bg: "bg-[#F59E0B]", title: "Texts are checked too", text: "A post or comment that breaks the rules is not published." },
  { icon: "⚖️", bg: "bg-crimson", title: "Strikes", text: "Each break is a strike. Too many in a short time and posting is paused for a while. A community that keeps breaking them is closed." },
  { icon: "🙋", bg: "bg-[#2FA37A]", title: "Think we got it wrong?", text: "Ask for a review. A person on our Trust & safety team decides within 48 hours." },
];

export default function RulesCard({ className = "", more = true, heading = true }: { className?: string; more?: boolean; heading?: boolean }) {
  return (
    <section className={className} aria-label="Rules">
      {heading && <p className="mb-2 font-ui text-xs font-bold uppercase tracking-wide text-ink">Rules</p>}
      <div className="rounded-2xl border border-rule bg-card px-4 py-1">
        {RULES.map((r, i) => (
          <div key={r.title} className={`flex items-start gap-3 py-3 ${i ? "border-t border-rule" : ""}`}>
            <span aria-hidden className={`flex h-9 w-9 flex-none items-center justify-center rounded-[10px] text-lg text-white ${r.bg}`}>{r.icon}</span>
            <div>
              <p className="font-ui text-sm font-bold text-ink">{r.title}</p>
              <p className="text-xs leading-relaxed text-slate">{r.text}</p>
            </div>
          </div>
        ))}
      </div>
      {more && <p className="mt-2 text-xs text-slate">The same rules apply to public, followers-only and subscriber-only posts. Private messages are not read. <Link href="/content-rules" className="text-crimson underline">More about the rules</Link></p>}
    </section>
  );
}
