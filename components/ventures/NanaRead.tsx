import type { NanaRead } from "@/lib/ventures";

// Nana's three tests on a pitch (lib/ventures.ts VET_TESTS): a verdict and the reason for each, and the questions worth asking. The
// verdict is written out in words (colour only repeats it).
const tone = (v: string) =>
  v === "Strong" || v === "Right on time" ? "bg-green-100 text-green-900" : v === "Weak" || v === "Late" ? "bg-crimson/10 text-crimson" : "bg-field text-ink";

export default function NanaReadView({ read, who = "team" }: { read: NanaRead; who?: "team" | "founder" }) {
  return (
    <div className="space-y-3 rounded-xl border border-rule bg-paper p-3 text-sm">
      {read.tests.map((t) => (
        <div key={t.key}>
          <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">{t.label} <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${tone(t.verdict)}`}>{t.verdict}</span></p>
          {t.why && <p className="mt-1 text-slate">{t.why}</p>}
        </div>
      ))}
      {read.ask.length > 0 && (
        <div>
          <p className="font-semibold text-ink">{who === "team" ? "Worth asking the founders" : "Questions a reviewer may ask you"}</p>
          <ul className="mt-1 list-disc pl-5 text-slate">{read.ask.map((q) => <li key={q}>{q}</li>)}</ul>
        </div>
      )}
      <p className="text-[11px] text-slate">{who === "team" ? "Nana's read, from the pitch alone. She doesn't rank or decide: a person reads every pitch and makes the call." : "Only you see this; nothing is kept or sent to the team. Nana reads only what you wrote, so sharpen the weak parts before you send."} · {read.at.slice(0, 16).replace("T", " ")}</p>
    </div>
  );
}
