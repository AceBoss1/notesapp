"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAdminAuth } from "@/lib/useAdminAuth";
import { describeChanges, nairaText, type PricingConfig } from "@/lib/pricing";

type Log = { id: string; at: string; byEmail: string; reset?: boolean; changes: string[] };
type Data = { config: PricingConfig; defaults: PricingConfig; customised: boolean; updatedAt: string | null; updatedBy: string | null; log: Log[] };

const field = "block w-24 rounded-lg border border-rule bg-card px-2 py-1.5 text-right text-sm";
const btn = "rounded-full bg-crimson px-5 py-2 font-ui text-xs font-semibold text-paper hover:bg-crimson-bright disabled:opacity-50";
const ghost = "rounded-full border border-rule px-4 py-2 font-ui text-xs font-semibold hover:border-crimson disabled:opacity-50";

// The form works in naira and percents; the server stores kobo and fractions. These convert both ways on the same object shape.
const KOBO_KEYS = new Set(["monthlyKobo", "yearlyKobo", "fromMonthlyKobo", "fromYearlyKobo", "badgeKobo", "depositKobo", "priceKobo", "enterpriseCoursesMonthlyKobo", "academyApiFromMonthlyKobo", "certificateMinKobo", "creditKobo", "siteCeilingKobo", "usdKobo", "standard", "basic", "pro", "business", "enterprise"]); // the plan names are kobo only as numbers (Nana budgets); as objects they are walked into
const RATE_EXTRA = new Set(["weeklyRate", "capRate"]);
const RATE_KEYS = new Set(["session", "physical", "digital", "adShare", "floorSession", "floorPhysical", "floorDigital"]);
type Any = any; // eslint-disable-line @typescript-eslint/no-explicit-any
function convert(v: Any, key: string, toForm: boolean): Any {
  if (Array.isArray(v)) return v.map((x) => convert(x, key, toForm));
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, convert(x, k, toForm)]));
  if (typeof v === "number" || typeof v === "string") {
    if (KOBO_KEYS.has(key)) return toForm ? String(Number(v) / 100) : Math.round(Number(v) * 100);
    if (RATE_KEYS.has(key) || RATE_EXTRA.has(key)) return toForm ? String(Math.round(Number(v) * 10000) / 100) : Number(v) / 100;
    if (key === "impressions" || key === "graceDays" || key === "inUsd" || key === "outUsd") return toForm ? String(v) : Number(v);
  }
  return v;
}
const get = (o: Any, path: string[]) => path.reduce((a, k) => a?.[k], o);

export default function PricingPage() {
  const { user, loading } = useAdminAuth();
  const [data, setData] = useState<Data | null>(null);
  const [form, setForm] = useState<Any>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const call = useCallback(async (body?: Record<string, unknown>) => {
    const r = await fetch("/api/admin/pricing", body
      ? { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user!.getIdToken()}` }, body: JSON.stringify(body) }
      : { headers: { Authorization: `Bearer ${await user!.getIdToken()}` } });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "Something went wrong");
    return j;
  }, [user]);
  const load = useCallback(() => call().then((d: Data) => { setData(d); setForm(convert(d.config, "", true)); }).catch((e) => setError(e.message)), [call]);
  useEffect(() => { if (user) load(); }, [user, load]);

  const candidate = useMemo<PricingConfig | null>(() => (form ? convert(form, "", false) : null), [form]);
  const changes = useMemo(() => (data && candidate ? describeChanges(data.config, candidate) : []), [data, candidate]);

  if (loading) return <p className="p-8 text-slate">Loading…</p>;
  if (!user) return <p className="p-8 text-slate">Admins only.</p>;
  const set = (path: string[], v: string) => setForm((f: Any) => { const n = structuredClone(f); let o = n; path.slice(0, -1).forEach((k) => (o = o[k])); o[path[path.length - 1]] = v; return n; });
  const input = (path: string[], suffix: string, label: string) => (
    <label className="inline-flex items-center gap-1 text-xs text-slate"><span className="sr-only">{label}</span>
      <input aria-label={label} className={field} inputMode="decimal" value={get(form, path) ?? ""} onChange={(e) => set(path, e.target.value)} />{suffix}
    </label>
  );
  const save = async (body: Record<string, unknown>, ok: string) => {
    setBusy(true); setError(""); setNote("");
    try { await call(body); setNote(ok); await load(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  const yearlyNote = (t: "pro" | "business") => { const m = Number(form[t].monthlyKobo), y = Number(form[t].yearlyKobo); return m > 0 && y > 0 ? `${(y / m).toFixed(1)} months' price a year` : ""; };

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <Link href="/admin" className="font-ui text-xs font-semibold text-crimson">← Admin</Link>
      <h1 className="mt-2 font-display text-4xl text-ink">Pricing &amp; revenue rates</h1>
      <p className="mt-2 max-w-3xl text-sm text-slate">
        The prices of the paid plans and the Enterprise course packages, our share of sessions, subscriptions, gifts and sales, what publishers earn from ads, the badge prices and the boost and ad packages. Changes apply to
        <strong> new purchases straight away</strong> on every page and checkout. People already subscribed stay on the price of the plan they bought until they resubscribe; sales already made keep the rate they were made at. Only the owner and super admins can change these, and every change is logged.
      </p>
      {error && <p className="mt-4 whitespace-pre-line text-sm text-red-700" role="alert">{error}</p>}
      {note && <p className="mt-4 text-sm text-green-700" role="status">{note}</p>}
      {!data || !form ? <p className="mt-8 text-slate">Loading…</p> : (
        <>
          <p className="mt-3 text-xs text-slate">{data.customised ? `Customised${data.updatedBy ? ` by ${data.updatedBy}` : ""}${data.updatedAt ? ` on ${new Date(data.updatedAt).toLocaleString("en-NG", { hour12: true })}` : ""}.` : "Using the built-in prices."}</p>

          <section className="card mt-6 p-5">
            <h2 className="font-display text-2xl text-ink">Subscription plans</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[34rem] text-sm">
                <thead><tr className="bg-crimson text-left text-[13px] text-white"><th className="px-3 py-2">Plan</th><th className="px-3 py-2">Per month, ₦</th><th className="px-3 py-2">Per year, ₦</th><th className="px-3 py-2">Note</th></tr></thead>
                <tbody>
                  {(["pro", "business"] as const).map((t, i) => (
                    <tr key={t} className={i % 2 ? "bg-[#fbf6f2]" : "bg-white"}><td className="px-3 py-3 font-semibold capitalize">{t}</td><td className="px-3 py-3">{input([t, "monthlyKobo"], "", `${t} monthly price`)}</td><td className="px-3 py-3">{input([t, "yearlyKobo"], "", `${t} yearly price`)}</td><td className="px-3 py-3 text-xs text-slate">{yearlyNote(t)}</td></tr>
                  ))}
                  <tr className="bg-white"><td className="px-3 py-3 font-semibold">Enterprise <span className="font-normal text-slate">(shown as “from”)</span></td><td className="px-3 py-3">{input(["enterprise", "fromMonthlyKobo"], "", "Enterprise from monthly")}</td><td className="px-3 py-3">{input(["enterprise", "fromYearlyKobo"], "", "Enterprise from yearly")}</td><td className="px-3 py-3 text-xs text-slate">Agreed per account</td></tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="card mt-6 p-5">
            <h2 className="font-display text-2xl text-ink">Enterprise course packages</h2>
            <p className="mt-1 text-xs text-slate">Two packages on top of the regular Enterprise plan, whose price above stays as it is for anyone who takes neither. Shown on the pricing page.</p>
            <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
              <div className="flex items-center justify-between gap-3"><span>Enterprise Courses, per month, ₦</span>{input(["coursePackages", "enterpriseCoursesMonthlyKobo"], "", "Enterprise Courses monthly price")}</div>
              <div className="flex items-center justify-between gap-3"><span>Enterprise Academy API, from, per month, ₦ <span className="text-xs text-slate">(plus usage)</span></span>{input(["coursePackages", "academyApiFromMonthlyKobo"], "", "Enterprise Academy API monthly from price")}</div>
              <div className="flex items-center justify-between gap-3"><span>Certificate on a free course, our minimum, ₦ <span className="text-xs text-slate">(the teacher&apos;s margin comes on top)</span></span>{input(["coursePackages", "certificateMinKobo"], "", "Certificate minimum")}</div>
            </div>
          </section>

          <section className="card mt-6 p-5">
            <h2 className="font-display text-2xl text-ink">Certificates claimed late</h2>
            <p className="mt-1 text-xs text-slate">A learner who finishes a free course can claim the certificate whenever they like. After the free days the price rises by a share of the starting price (our minimum plus the teacher&apos;s margin) for each full week, not compounding, up to the cap. The learner sees it as a &quot;late claim fee&quot; before paying.</p>
            <div className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
              <div className="flex items-center justify-between gap-3"><span>Free days after finishing</span>{input(["certificateLate", "graceDays"], "days", "Certificate grace days")}</div>
              <div className="flex items-center justify-between gap-3"><span>Added each week after that</span>{input(["certificateLate", "weeklyRate"], "%", "Certificate late fee per week")}</div>
              <div className="flex items-center justify-between gap-3"><span>At most</span>{input(["certificateLate", "capRate"], "%", "Certificate late fee cap")}</div>
            </div>
          </section>

          <section className="card mt-6 p-5">
            <h2 className="font-display text-2xl text-ink">Nana AI allowances</h2>
            <p className="mt-1 text-xs text-slate">What each member can spend a month on our AI account, in naira of what the AI costs us: chats, writing help, summaries. It is shared out over the reset period below and refreshes on that timer (unused allowance doesn&apos;t carry over). When it runs out, Nana uses the member&apos;s Nana credit, then answers from the help centre. Members with their own AI key are never limited. The site-wide ceiling pauses free allowances for the rest of the month; bought credit still works. Gems: Pearl for everyone, Emerald from Business, Ruby on Enterprise (models in Settings: NANA_MODEL, NANA_MODEL_EMERALD, NANA_MODEL_RUBY).</p>
            <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
              {(["standard", "basic", "pro", "business", "enterprise"] as const).map((t) => (
                <div key={t} className="flex items-center justify-between gap-3"><span>{t === "standard" ? "Free" : t === "basic" ? "Free Basic" : t[0].toUpperCase() + t.slice(1)}, per member a month, ₦</span>{input(["nana", "budgets", t], "", `Nana budget ${t}`)}</div>
              ))}
              <div className="flex items-center justify-between gap-3"><span>Site-wide ceiling a month, ₦</span>{input(["nana", "siteCeilingKobo"], "", "Nana site ceiling")}</div>
              <label className="flex items-center justify-between gap-3"><span>Allowance refreshes every</span>
                <select aria-label="Nana allowance reset" className={`${field} !w-40 !text-left`} value={form.nana?.resetEvery ?? "week"} onChange={(e) => set(["nana", "resetEvery"], e.target.value)}><option value="day">day</option><option value="week">week (Monday)</option><option value="month">month (the 1st)</option></select>
              </label>
              <label className="flex items-center justify-between gap-3"><span>The allowance covers</span>
                <select aria-label="Nana allowance covers" className={`${field} !w-40 !text-left`} value={form.nana?.allowanceGems ?? "all"} onChange={(e) => set(["nana", "allowanceGems"], e.target.value)}><option value="all">every gem</option><option value="pearl">Pearl only</option></select>
              </label>
            </div>
            <p className="mt-4 font-ui text-xs font-bold text-ink">What the models cost us</p>
            <p className="mt-1 text-xs text-slate">The provider&apos;s list prices in US dollars per million tokens, and the naira to the dollar. Each answer&apos;s cost is worked out from these and taken from the allowance, then credit. Check them when a model or the exchange rate changes.</p>
            <div className="mt-2 grid gap-3 text-sm sm:grid-cols-3">
              {(["pearl", "emerald", "ruby"] as const).map((g) => (
                <div key={g} className="rounded-lg border border-rule p-3">
                  <p className="font-semibold capitalize">{g}</p>
                  <div className="mt-2 flex items-center justify-between gap-2"><span className="text-xs">Input, $</span>{input(["nana", "rates", g, "inUsd"], "", `${g} input price`)}</div>
                  <div className="mt-2 flex items-center justify-between gap-2"><span className="text-xs">Output, $</span>{input(["nana", "rates", g, "outUsd"], "", `${g} output price`)}</div>
                </div>
              ))}
              <div className="flex items-center justify-between gap-3 sm:col-span-3"><span>Naira to one US dollar, ₦</span>{input(["nana", "usdKobo"], "", "Naira to the dollar")}</div>
            </div>
            <p className="mt-4 font-ui text-xs font-bold text-ink">Top-ups a member can buy</p>
            <div className="mt-2 grid gap-3 text-sm sm:grid-cols-3">
              {(form.nana?.topUps ?? []).map((t: { id: string; name: string }, k: number) => (
                <div key={t.id} className="rounded-lg border border-rule p-3">
                  <p className="font-semibold">{t.name}</p>
                  <div className="mt-2 flex items-center justify-between gap-2"><span className="text-xs">Price, ₦</span>{input(["nana", "topUps", String(k), "priceKobo"], "", `${t.name} price`)}</div>
                  <div className="mt-2 flex items-center justify-between gap-2"><span className="text-xs">AI credit, ₦</span>{input(["nana", "topUps", String(k), "creditKobo"], "", `${t.name} credit`)}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="card mt-6 p-5">
            <h2 className="font-display text-2xl text-ink">What we take, and what publishers earn from ads</h2>
            <p className="mt-1 text-xs text-slate">Percentages. Session and unlock rate also applies to subscriptions to a publisher and to gifts. “Ad share” is the publisher&apos;s part of ad revenue on their pages. Enterprise accounts use their own agreed rates; the floors are used when none has been set.</p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[40rem] text-sm">
                <thead><tr className="bg-crimson text-left text-[13px] text-white"><th className="px-3 py-2">Plan</th><th className="px-3 py-2">Session, subscription and gift cut</th><th className="px-3 py-2">Physical goods cut</th><th className="px-3 py-2">Digital goods cut</th><th className="px-3 py-2">Publisher ad share</th></tr></thead>
                <tbody>
                  {(["basic", "pro", "business"] as const).map((t, i) => (
                    <tr key={t} className={i % 2 ? "bg-[#fbf6f2]" : "bg-white"}><td className="px-3 py-3 font-semibold capitalize">{t === "basic" ? "Free Basic" : t}</td>
                      {["session", "physical", "digital", "adShare"].map((k) => <td key={k} className="px-3 py-3">{input([t, k], "%", `${t} ${k}`)}</td>)}</tr>
                  ))}
                  <tr className="bg-white"><td className="px-3 py-3 font-semibold">Enterprise <span className="font-normal text-slate">(floor)</span></td>
                    {["floorSession", "floorPhysical", "floorDigital", "adShare"].map((k) => <td key={k} className="px-3 py-3">{input(["enterprise", k], "%", `enterprise ${k}`)}</td>)}</tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="card mt-6 p-5">
            <h2 className="font-display text-2xl text-ink">Badges</h2>
            <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
              <div className="flex items-center justify-between gap-3"><span>Verified badge add-on, per month, ₦</span>{input(["badgeKobo"], "", "Verified badge price")}</div>
              <span />
              <div className="flex items-center justify-between gap-3"><span>Gold, person, per month, ₦</span>{input(["gold", "personal", "monthlyKobo"], "", "Gold personal monthly")}</div>
              <div className="flex items-center justify-between gap-3"><span>Gold, person, identity-check deposit, ₦</span>{input(["gold", "personal", "depositKobo"], "", "Gold personal deposit")}</div>
              <div className="flex items-center justify-between gap-3"><span>Gold, organisation, per month, ₦</span>{input(["gold", "corporate", "monthlyKobo"], "", "Gold organisation monthly")}</div>
              <div className="flex items-center justify-between gap-3"><span>Gold, organisation, identity-check deposit, ₦</span>{input(["gold", "corporate", "depositKobo"], "", "Gold organisation deposit")}</div>
            </div>
          </section>

          {(["boosts", "ads"] as const).map((k) => (
            <section key={k} className="card mt-6 p-5">
              <h2 className="font-display text-2xl text-ink">{k === "boosts" ? "Post and item boost packages" : "Advertising packages"}</h2>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[30rem] text-sm">
                  <thead><tr className="bg-crimson text-left text-[13px] text-white"><th className="px-3 py-2">Package</th><th className="px-3 py-2">Impressions</th><th className="px-3 py-2">Price, ₦</th><th className="px-3 py-2">Per 1,000</th></tr></thead>
                  <tbody>
                    {form[k].map((p: Any, i: number) => {
                      const imp = Number(p.impressions), pr = Number(p.priceKobo);
                      return (
                        <tr key={p.id} className={i % 2 ? "bg-[#fbf6f2]" : "bg-white"}><td className="px-3 py-3 font-semibold">{p.name}</td><td className="px-3 py-3">{input([k, String(i), "impressions"], "", `${p.name} impressions`)}</td><td className="px-3 py-3">{input([k, String(i), "priceKobo"], "", `${p.name} price`)}</td><td className="px-3 py-3 text-xs text-slate">{imp > 0 && pr > 0 ? nairaText(Math.round(((pr * 100) / imp) * 1000)) : ""}</td></tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ))}

          <section className="mt-8 rounded-2xl border border-crimson p-5">
            <h2 className="font-display text-xl text-ink">{changes.length ? `${changes.length} change${changes.length === 1 ? "" : "s"} to save` : "No changes yet"}</h2>
            {changes.length > 0 && <ul className="mt-2 max-h-48 list-disc space-y-0.5 overflow-auto pl-5 font-mono text-xs text-slate">{changes.map((c) => <li key={c}>{c.replace(/Kobo/g, " (kobo)")}</li>)}</ul>}
            <div className="mt-4 flex flex-wrap gap-2">
              <button className={btn} disabled={busy || !changes.length} onClick={() => save({ config: candidate }, "Saved. The new prices are live.")}>Save and apply</button>
              <button className={ghost} disabled={busy || !changes.length} onClick={() => setForm(convert(data.config, "", true))}>Discard edits</button>
              {data.customised && <button className={ghost} disabled={busy} onClick={() => { if (confirm("Go back to the built-in prices and rates?")) save({ reset: true }, "Back to the built-in prices."); }}>Reset to built-in prices</button>}
            </div>
          </section>

          <section className="mt-8">
            <h2 className="font-display text-2xl text-ink">Change log</h2>
            {data.log.length === 0 ? <p className="mt-2 text-sm text-slate">No changes yet.</p> : (
              <ul className="mt-3 space-y-3">
                {data.log.map((l) => (
                  <li key={l.id} className="card p-4 text-sm"><p className="font-ui text-xs font-semibold text-slate">{new Date(l.at).toLocaleString("en-NG", { hour12: true })} · {l.byEmail}{l.reset ? " · reset to built-in" : ""}</p>
                    <ul className="mt-1 list-disc pl-5 font-mono text-xs text-slate">{l.changes.map((c) => <li key={c}>{c.replace(/Kobo/g, " (kobo)")}</li>)}</ul></li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
