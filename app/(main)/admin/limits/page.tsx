"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { useAdminAuth } from "@/lib/useAdminAuth";
import { LIMITS, LIMIT_TIERS, LIMIT_TIER_LABEL, type LimitTable } from "@/lib/limits";
import { AGENT_DEFAULTS, AGENT_SETTINGS, type AgentSettings } from "@/lib/agents/config";
import { ROOM_DEFAULTS, ROOM_SETTINGS, type RoomSettings } from "@/lib/rooms";

// Size and count limits by plan (message files, moments, courses), the plan switches for Notes Academy (free courses, paid courses,
// uploaded video) and for Nana's operator and connected agents, shown as tick boxes, and the numbers behind Nana's jobs and agents
// (undo windows, expiry, defaults on the Connect screen), and the audio room settings (the Cloudflare relay switch, listeners per room on the
// relay and phone to phone, slow mode for big rooms' chat, and Live mode: video, its budget and the host's prompts, lib/rooms-live.ts). Saved numbers apply sitewide within about 30 seconds; "Reset" puts the
// built-in defaults back in the boxes (nothing changes until you save).
export default function AdminLimitsPage() {
  const { user, loading } = useAdminAuth();
  const [table, setTable] = useState<LimitTable | null>(null);
  const [agents, setAgents] = useState<AgentSettings | null>(null);
  const [rooms, setRooms] = useState<RoomSettings | null>(null);
  const [relayKeys, setRelayKeys] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const call = useCallback(async (init?: RequestInit) => {
    const r = await fetch("/api/admin/limits", { ...init, headers: { Authorization: `Bearer ${await user!.getIdToken()}`, "Content-Type": "application/json" } });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "Something went wrong");
    return j as { limits: LimitTable; agents: AgentSettings; rooms: RoomSettings; relayKeys: boolean };
  }, [user]);
  useEffect(() => { if (user) call().then((j) => { setTable(j.limits); setAgents(j.agents); setRooms(j.rooms); setRelayKeys(j.relayKeys); }).catch((e) => setError(e.message)); }, [user, call]);

  const set = (key: string, tier: string, v: string) => setTable((t) => t && ({ ...t, [key]: { ...t[key as keyof LimitTable], [tier]: v === "" ? NaN : Number(v) } }));
  async function save() {
    setBusy(true); setError(""); setSaved(false);
    try { const j = await call({ method: "POST", body: JSON.stringify({ limits: table, agents, rooms }) }); setTable(j.limits); setAgents(j.agents); setRooms(j.rooms); setRelayKeys(j.relayKeys); setSaved(true); }
    catch (e) { setError(e instanceof Error ? e.message : "Something went wrong"); }
    finally { setBusy(false); }
  }
  const reset = () => { setTable((t) => t && (Object.fromEntries(LIMITS.map((l) => [l.key, { ...l.defaults }])) as LimitTable)); setAgents({ ...AGENT_DEFAULTS }); setRooms({ ...ROOM_DEFAULTS }); };

  if (loading) return <p className="p-8 text-slate">Loading…</p>;
  if (!user) return <p className="p-8 text-slate">Admins only.</p>;
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="font-display text-3xl text-ink">Limits by plan</h1>
      <p className="mt-2 text-sm text-slate">Sizes, counts and switches for each plan. Ticked means the plan has it; a 0 in a row marked &ldquo;0 = no limit&rdquo; means no limit. A saved change applies sitewide within about 30 seconds; people already over a new, lower limit just can&apos;t add more until they&apos;re under it. Whole numbers only.</p>
      {error && <p className="mt-4 text-sm text-red-700" role="alert">{error}</p>}
      {saved && <p className="mt-4 text-sm text-green-700" role="status">Saved. It&apos;s live.</p>}
      {table && (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-rule text-left">
                <th className="py-2 pr-4">Limit</th>
                {LIMIT_TIERS.map((t) => <th key={t} className="px-2 py-2">{LIMIT_TIER_LABEL[t]}</th>)}
              </tr>
            </thead>
            <tbody>
              {LIMITS.map((l, i) => (
                <Fragment key={l.key}>
                  {(i === 0 || LIMITS[i - 1].group !== l.group) && <tr><td colSpan={6} className="pt-5 font-mono text-xs uppercase tracking-wide text-slate">{l.group}</td></tr>}
                  <tr className="border-b border-rule">
                    <td className="py-2 pr-4">{l.label} {l.kind !== "switch" && <span className="text-slate">({l.unit}, {l.min}–{l.max})</span>}</td>
                    {LIMIT_TIERS.map((t) => (
                      <td key={t} className="px-2 py-2">
                        {l.kind === "switch" ? (
                          <input type="checkbox" checked={table[l.key][t] > 0} onChange={(e) => set(l.key, t, e.target.checked ? "1" : "0")}
                            aria-label={`${l.label}, ${LIMIT_TIER_LABEL[t]}`} className="h-4 w-4 accent-crimson" />
                        ) : (
                        <input type="number" inputMode="numeric" min={l.min} max={l.max} step={1} value={Number.isNaN(table[l.key][t]) ? "" : table[l.key][t]}
                          onChange={(e) => set(l.key, t, e.target.value)} aria-label={`${l.label}, ${LIMIT_TIER_LABEL[t]}`} className="w-20 rounded border border-rule px-2 py-1" />
                        )}
                      </td>
                    ))}
                  </tr>
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {agents && (
        <section className="mt-10">
          <h2 className="font-display text-2xl text-ink">Nana and connected agents</h2>
          <p className="mt-1 text-sm text-slate">The same for every plan. Publishing and price changes always ask first, and agents never move money (they spend ₦0): those can&apos;t be changed here.</p>
          <table className="mt-4 w-full border-collapse text-sm"><tbody>
            {AGENT_SETTINGS.map((a) => (
              <tr key={a.key} className="border-b border-rule">
                <td className="py-2 pr-4">{a.label} <span className="text-slate">({a.unit}, {a.min}–{a.max.toLocaleString("en-GB")}; default {a.def.toLocaleString("en-GB")})</span></td>
                <td className="px-2 py-2"><input type="number" inputMode="numeric" min={a.min} max={a.max} step={1} value={Number.isNaN(agents[a.key]) ? "" : agents[a.key]}
                  onChange={(e) => setAgents({ ...agents, [a.key]: e.target.value === "" ? NaN : Number(e.target.value) })} aria-label={a.label} className="w-24 rounded border border-rule px-2 py-1" /></td>
              </tr>
            ))}
          </tbody></table>
        </section>
      )}
      {rooms && (
        <section className="mt-10">
          <h2 className="font-display text-2xl text-ink">Audio rooms</h2>
          <p className="mt-1 text-sm text-slate">The same for every plan. A new room uses the Cloudflare relay when the switch is on and its keys are set; rooms already open keep the way they started. {relayKeys ? "The relay's keys are set." : "The relay's keys aren't set yet (CLOUDFLARE_REALTIME_APP_ID and CLOUDFLARE_REALTIME_APP_TOKEN in Vercel), so rooms run phone to phone whatever the switch says."} What limits a relay room is Firestore reads (everyone in a room reads each change to it and each chat message), not Cloudflare; slow mode keeps a big room&apos;s chat affordable.</p>
          {([["", "Audio rooms"], ["live", "Live mode (video in relay rooms)"]] as const).map(([group, heading]) => (
            <div key={heading}>
              {group && <>
                <h3 className="mt-6 font-ui text-sm font-bold text-ink">{heading}</h3>
                <p className="mt-1 text-sm text-slate">The host (and speakers, if the host allows) can turn video on in a relay room; it goes through the relay as a second track, capped below. While it&apos;s off everyone sees the host&apos;s poster, a picture that never counts as video. Each live gets a budget of video minutes counted by the server; the host is prompted when listeners drop or a burst of video runs long, and video turns off by itself after the grace once the minutes are used. Viewers can choose Audio only (on by itself on slow connections).</p>
              </>}
              <table className="mt-4 w-full border-collapse text-sm"><tbody>
                {ROOM_SETTINGS.filter((a) => (a.group ?? "") === group).map((a) => (
              <tr key={a.key} className="border-b border-rule">
                <td className="py-2 pr-4">{a.label} {a.kind !== "switch" && <span className="text-slate">({a.unit}, {a.min}–{a.max.toLocaleString("en-GB")}; default {a.def.toLocaleString("en-GB")})</span>}</td>
                <td className="px-2 py-2">{a.kind === "switch"
                  ? <input type="checkbox" checked={rooms[a.key] > 0} onChange={(e) => setRooms({ ...rooms, [a.key]: e.target.checked ? 1 : 0 })} aria-label={a.label} className="h-4 w-4 accent-crimson" />
                  : <input type="number" inputMode="numeric" min={a.min} max={a.max} step={1} value={Number.isNaN(rooms[a.key]) ? "" : rooms[a.key]}
                    onChange={(e) => setRooms({ ...rooms, [a.key]: e.target.value === "" ? NaN : Number(e.target.value) })} aria-label={a.label} className="w-24 rounded border border-rule px-2 py-1" />}</td>
              </tr>
            ))}
              </tbody></table>
            </div>
          ))}
        </section>
      )}
      <div className="mt-6 flex gap-3">
        <button onClick={save} disabled={busy || !table} className="btn-primary disabled:opacity-50">Save limits</button>
        <button onClick={reset} disabled={!table} className="btn-ghost">Reset to defaults</button>
      </div>
    </div>
  );
}
