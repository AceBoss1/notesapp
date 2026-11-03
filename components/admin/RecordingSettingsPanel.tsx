"use client";

import { useCallback, useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { RECORDING_DEFAULTS, RECORDING_SETTINGS, type RecordingSettings } from "@/lib/live-recording";

// Admin → Limits → Live recording: how long recordings are kept, the longest recording, and the force switch (lib/live-recording.ts).
// Saved on its own (its own button), so it sits under the audio room settings without touching them.
export default function RecordingSettingsPanel({ user }: { user: User }) {
  const [s, setS] = useState<RecordingSettings | null>(null);
  const [ready, setReady] = useState(false);
  const [transcripts, setTranscripts] = useState("off");
  const [msg, setMsg] = useState("");
  const call = useCallback(async (init?: RequestInit) => {
    const r = await fetch("/api/admin/recording", { ...init, headers: { Authorization: `Bearer ${await user.getIdToken()}`, "Content-Type": "application/json" } });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "Something went wrong");
    setS(j.recording); setReady(j.recorderReady); setTranscripts(j.transcripts);
  }, [user]);
  useEffect(() => { call().catch((e) => setMsg(e.message)); }, [call]);
  if (!s) return msg ? <p className="mt-6 text-sm text-crimson">{msg}</p> : null;
  return (
    <section className="mt-10">
      <h2 className="font-display text-2xl text-ink">Live recording</h2>
      <p className="mt-1 text-sm text-slate">
        Hosts switch recording on before going live (off by default); everyone is told and speakers agree first. Which plans can record and
        publish replays are the &quot;Audio rooms and live&quot; switches in the table above. {ready ? "The recorder is set up." : "The recorder isn't set up yet (RECORDER_URL and RECORDER_SECRET in Vercel, docs/RECORDER.md), so the switch is hidden from hosts."} Transcripts: {transcripts === "off" ? "off (REPLAY_TRANSCRIBE)" : transcripts}.
      </p>
      <table className="mt-4 w-full border-collapse text-sm"><tbody>
        {RECORDING_SETTINGS.map((a) => (
          <tr key={a.key} className="border-b border-rule">
            <td className="py-2 pr-4">{a.label} {a.kind !== "switch" && <span className="text-slate">({a.unit}, {a.min}–{a.max}; default {a.def})</span>}</td>
            <td className="px-2 py-2">{a.kind === "switch"
              ? <input type="checkbox" checked={s[a.key] > 0} onChange={(e) => setS({ ...s, [a.key]: e.target.checked ? 1 : 0 })} aria-label={a.label} className="h-4 w-4 accent-crimson" />
              : <input type="number" inputMode="numeric" min={a.min} max={a.max} step={1} value={Number.isNaN(s[a.key]) ? "" : s[a.key]} onChange={(e) => setS({ ...s, [a.key]: e.target.value === "" ? NaN : Number(e.target.value) })} aria-label={a.label} className="w-24 rounded border border-rule px-2 py-1" />}</td>
          </tr>
        ))}
      </tbody></table>
      <div className="mt-4 flex items-center gap-3">
        <button type="button" className="btn-primary" onClick={() => { setMsg(""); call({ method: "POST", body: JSON.stringify({ recording: s }) }).then(() => setMsg("Saved.")).catch((e) => setMsg(e.message)); }}>Save recording settings</button>
        <button type="button" className="btn-ghost" onClick={() => setS({ ...RECORDING_DEFAULTS })}>Reset</button>
        {msg && <span className="text-sm text-slate" role="status">{msg}</span>}
      </div>
    </section>
  );
}
