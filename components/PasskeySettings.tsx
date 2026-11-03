"use client";

import { useCallback, useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { addPasskey, listMyPasskeys, passkeysSupported, removeMyPasskey } from "@/lib/passkeys-client";
import { NAME_MAX, type PasskeyRow } from "@/lib/passkeys";

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" }) : "never");

// Account settings → Passkeys: add a passkey on this device, see the ones on the account, remove any. Staff use the same passkeys
// at the team hub's Staff login.
export default function PasskeySettings({ user }: { user: User }) {
  const [supported, setSupported] = useState(true);
  const [rows, setRows] = useState<PasskeyRow[] | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const load = useCallback(() => listMyPasskeys(user).then(setRows).catch((e) => setMsg({ ok: false, text: e.message })), [user]);
  useEffect(() => { setSupported(passkeysSupported()); load(); }, [load]);

  async function add() {
    setBusy(true); setMsg(null);
    try { await addPasskey(user, name.trim() || undefined); setName(""); setMsg({ ok: true, text: "Passkey added. Next time, choose Sign in with a passkey." }); await load(); }
    catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : "Couldn't add a passkey" }); }
    finally { setBusy(false); }
  }
  async function remove(p: PasskeyRow) {
    if (!confirm(`Remove the passkey "${p.name}"? You won't be able to sign in with it any more.`)) return;
    setBusy(true); setMsg(null);
    try { await removeMyPasskey(user, p.id); await load(); }
    catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : "Couldn't remove that passkey" }); }
    finally { setBusy(false); }
  }

  return (
    <div className="card mt-6 p-6" id="passkeys">
      <h2 className="font-display text-xl">Passkeys</h2>
      <p className="mt-1 text-sm text-slate">Sign in with your fingerprint, face, screen lock or a security key instead of your password. A passkey can&apos;t be guessed or phished, and it stays on your device. Staff can use it at the team hub&apos;s Staff login too.</p>
      {supported ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={NAME_MAX} placeholder="Name it (optional), e.g. My phone" aria-label="Passkey name"
            className="min-w-0 flex-1 rounded-xl border border-rule bg-card px-4 py-2 text-sm outline-none focus:border-crimson" />
          <button type="button" onClick={add} disabled={busy} className="rounded-full bg-crimson px-5 py-2 font-ui text-sm font-semibold text-paper disabled:opacity-50">{busy ? "Waiting for your device…" : "Add a passkey"}</button>
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate">This browser can&apos;t make passkeys. Try an up-to-date Chrome, Safari, Edge or Firefox.</p>
      )}
      {msg && <p className={`mt-3 text-sm ${msg.ok ? "text-green-700" : "text-red-700"}`} role={msg.ok ? "status" : "alert"}>{msg.text}</p>}
      {rows && rows.length > 0 && (
        <ul className="mt-4 divide-y divide-rule rounded border border-rule">
          {rows.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
              <div>
                <p className="font-semibold text-ink">{p.name}</p>
                <p className="text-xs text-slate">Added {when(p.createdAt)} · last used {when(p.lastUsedAt)} · {p.rpID}</p>
              </div>
              <button type="button" onClick={() => remove(p)} disabled={busy} className="rounded-full border border-red-300 px-3 py-1 font-ui text-xs font-semibold text-red-700">Remove</button>
            </li>
          ))}
        </ul>
      )}
      {rows && rows.length === 0 && <p className="mt-3 text-xs text-slate">No passkeys yet.</p>}
    </div>
  );
}
