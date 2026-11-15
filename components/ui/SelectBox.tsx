"use client";

// A dropdown in the style of the Moda user dashboard redesign: a rounded box with a chevron, a native <select> inside (so phones show their
// own picker). `label` sits above it, or inside on the left with `inline` ("Account  Emmanuel Adams ⌄"); `accent` is the crimson one
// that stands in for a row of tabs on a phone ("Overview ⌄").
export default function SelectBox<V extends string | number>({
  label, inline, hideLabel, value, onChange, options, accent, className = "", disabled,
}: {
  label?: string; inline?: boolean; hideLabel?: boolean; // hideLabel: read out, not shown
 value: V; onChange: (v: V) => void;
  options: readonly { value: V; label: string; disabled?: boolean }[]; accent?: boolean; className?: string; disabled?: boolean;
}) {
  const box = `relative flex h-[42px] items-center rounded-[10px] border bg-card px-3.5 focus-within:border-crimson ${accent ? "border-crimson-bright" : "border-rule"}`;
  return (
    <label className={`block font-ui ${className}`}>
      {label && !inline && <span className={hideLabel ? "sr-only" : "mb-1.5 block text-[13px] text-slate"}>{label}</span>}
      <span className={box}>
        {label && inline && <span className="mr-3 shrink-0 text-[13px] text-slate">{label}</span>}
        <select
          value={String(value)} disabled={disabled} aria-label={label}
          onChange={(e) => { const o = options.find((x) => String(x.value) === e.target.value); if (o) onChange(o.value); }}
          className={`min-w-0 flex-1 cursor-pointer appearance-none truncate bg-transparent pr-6 text-sm outline-none disabled:cursor-default ${accent ? "font-semibold text-crimson-bright" : "text-ink"}`}
        >
          {options.map((o) => <option key={String(o.value)} value={String(o.value)} disabled={o.disabled}>{o.label}</option>)}
        </select>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
          className={`pointer-events-none absolute right-3 h-3.5 w-3.5 ${accent ? "text-crimson-bright" : "text-slate"}`}><path d="m6 9 6 6 6-6" /></svg>
      </span>
    </label>
  );
}
