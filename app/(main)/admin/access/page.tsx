"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminAuth } from "@/lib/useAdminAuth";
import { DEPARTMENTS, Dept } from "@/lib/admin-access";

type Person = { uid: string; email: string; name: string; role: "super" | "admin"; depts: Dept[]; owner: boolean };
type LogRow = { id: string; at: string; byEmail: string; targetEmail: string; before: string; after: string };
type Data = { me: { uid: string; owner: boolean }; people: Person[]; log: LogRow[] };

// Who is on the team and what each person can open. Everyone here must already have a NotesApp account.
// Admins get one or more departments; super admins see everything. Only the owner appoints or removes super admins.
export default function AdminAccessPage() {
  const { user, loading } = useAdminAuth();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "super">("admin");
  const [depts, setDepts] = useState<Dept[]>([]);
  const [editing, setEditing] = useState<string | null>(null); // email being edited
  const [editDepts, setEditDepts] = useState<Dept[]>([]);

  const call = useCallback(async (init?: RequestInit) => {
    const r = await fetch("/api/admin/access", { ...init, headers: { Authorization: `Bearer ${await user!.getIdToken(true)}`, "Content-Type": "application/json" } });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "Something went wrong");
    return j;
  }, [user]);
  const load = useCallback(() => call().then(setData).catch((e) => setError(e.message)), [call]);
  useEffect(() => { if (user) load(); }, [user, load]);

  async function change(body: { email: string; role: "admin" | "super" | "none"; depts?: Dept[] }) {
    setBusy(true); setError(""); setNote("");
    try { const j = await call({ method: "POST", body: JSON.stringify(body) }); setNote(j.summary); setEditing(null); setEmail(""); setDepts([]); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Something went wrong"); }
    finally { setBusy(false); }
  }
  const toggle = (list: Dept[], d: Dept) => (list.includes(d) ? list.filter((x) => x !== d) : [...list, d]);
  const owner = !!data?.me.owner;
  // Super admins can manage admins; only the owner can touch super admins; nobody changes the owner or themselves.
  const canManage = (p: Person) => !p.owner && p.uid !== data?.me.uid && (p.role === "admin" || owner);

  const DeptBoxes = ({ value, onChange }: { value: Dept[]; onChange: (v: Dept[]) => void }) => (
    <div className="mt-2 grid gap-2 sm:grid-cols-2">
      {DEPARTMENTS.map((d) => (
        <label key={d.key} className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={value.includes(d.key)} onChange={() => onChange(toggle(value, d.key))} className="mt-1" />
          <span><span className="font-semibold text-ink">{d.label}</span> <span className="text-slate">{d.blurb}</span></span>
        </label>
      ))}
    </div>
  );

  if (loading) return <p className="p-8 text-slate">Loading…</p>;
  if (!user) return <p className="p-8 text-slate">Admins only.</p>;
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="font-display text-3xl text-ink">Team access</h1>
      <p className="mt-2 text-sm text-slate">Give a teammate access to the admin area and pick the departments they work in; they only see those pages. Super admins see everything. They need a NotesApp account first. Changes apply within a minute, and the person is signed out of old sessions when their access shrinks.</p>
      {error && <p className="mt-4 text-sm text-red-700" role="alert">{error}</p>}
      {note && <p className="mt-4 text-sm text-green-700" role="status">{note}</p>}

      <section className="mt-8 rounded border border-rule p-4">
        <h2 className="font-display text-xl text-ink">Add a team member</h2>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="their@email.com" aria-label="Email of the person to add" className="mt-3 w-full rounded border border-rule px-3 py-2" />
        {owner && (
          <div className="mt-3 flex gap-4 text-sm">
            <label><input type="radio" name="role" checked={role === "admin"} onChange={() => setRole("admin")} /> Admin (departments)</label>
            <label><input type="radio" name="role" checked={role === "super"} onChange={() => setRole("super")} /> Super admin (everything)</label>
          </div>
        )}
        {role === "admin" && <DeptBoxes value={depts} onChange={setDepts} />}
        <button type="button" disabled={busy || !email.trim() || (role === "admin" && depts.length === 0)} onClick={() => change({ email: email.trim(), role, depts: role === "admin" ? depts : [] })}
          className="mt-4 rounded-full bg-crimson px-5 py-2 font-ui text-sm font-semibold text-white disabled:opacity-50">{busy ? "Saving…" : "Give access"}</button>
      </section>

      <section className="mt-8">
        <h2 className="font-display text-xl text-ink">Who has access</h2>
        {!data ? <p className="mt-3 text-slate">Loading…</p> : (
          <ul className="mt-3 divide-y divide-rule rounded border border-rule">
            {data.people.map((p) => (
              <li key={p.uid} className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-ink">{p.name} <span className="ml-1 rounded-full border border-rule px-2 py-0.5 font-ui text-xs font-normal text-slate">{p.owner ? "Owner" : p.role === "super" ? "Super admin" : "Admin"}</span></p>
                    <p className="text-sm text-slate">{p.email}</p>
                    <p className="mt-1 text-sm text-ink">{p.role === "super" ? "Everything" : p.depts.map((d) => DEPARTMENTS.find((x) => x.key === d)?.label).join(", ") || "No departments yet"}</p>
                  </div>
                  {canManage(p) && (
                    <div className="flex gap-2 font-ui text-xs">
                      {p.role === "admin" && <button type="button" disabled={busy} onClick={() => { setEditing(editing === p.email ? null : p.email); setEditDepts(p.depts); }} className="rounded-full border border-rule px-3 py-1 font-semibold text-ink">Edit departments</button>}
                      <button type="button" disabled={busy} onClick={() => { if (confirm(`Remove ${p.name}'s admin access?`)) change({ email: p.email, role: "none" }); }} className="rounded-full border border-red-300 px-3 py-1 font-semibold text-red-700">Remove</button>
                    </div>
                  )}
                </div>
                {editing === p.email && (
                  <div className="mt-3">
                    <DeptBoxes value={editDepts} onChange={setEditDepts} />
                    <button type="button" disabled={busy || editDepts.length === 0} onClick={() => change({ email: p.email, role: "admin", depts: editDepts })} className="mt-3 rounded-full bg-crimson px-4 py-1.5 font-ui text-xs font-semibold text-white disabled:opacity-50">Save</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {data && data.log.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-xl text-ink">Recent changes</h2>
          <ul className="mt-3 space-y-1 text-sm text-slate">
            {data.log.map((l) => <li key={l.id}>{new Date(l.at).toLocaleString()} — {l.byEmail} changed {l.targetEmail}: {l.before} → {l.after}</li>)}
          </ul>
        </section>
      )}
    </div>
  );
}
