"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { DEFAULT_AVATAR } from "@/lib/admin";
import { cleanSlug } from "@/lib/community";
import { capi, field } from "./api";

// /community: the communities on #NotesApp (most members first, mine marked) and "Start a community" (any account).
type Row = { id: string; name: string; tagline: string; avatar: string; memberCount: number; verified: boolean; joinMode: string; status: string | null };

export default function Directory() {
  const router = useRouter();
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [list, setList] = useState<Row[] | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [tagline, setTagline] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  useEffect(() => { if (user !== undefined) capi<{ communities: Row[] }>("/api/community").then((d) => setList(d.communities)).catch(() => setList([])); }, [user]);
  async function create() {
    setBusy(true); setErr("");
    try { const r = await capi<{ community: { id: string } }>("/api/community", { action: "create", name, id: slug || name, tagline }); router.push(`/c/${r.community.id}?tab=admin`); }
    catch (e) { setErr(e instanceof Error ? e.message : "Couldn't start it."); setBusy(false); }
  }
  const mine = (list ?? []).filter((c) => c.status === "active");
  return (
    <div>
      {mine.length > 0 && <><h2 className="font-display text-2xl text-ink">Your communities</h2><Grid list={mine} /></>}
      <h2 className="mt-10 font-display text-2xl text-ink">Communities on #NotesApp</h2>
      {list === null ? <p className="mt-4 text-sm text-slate">Loading…</p> : !list.length ? <p className="card mt-4 p-6 text-sm text-slate">None yet. Start the first.</p> : <Grid list={list} />}
      <section id="start" className="card mt-10 p-6">
        <h2 className="font-display text-2xl text-ink">Start a community</h2>
        <p className="mt-1 text-sm text-slate">For your church, NGO, school, club or association. Free up to 200 members; you choose who can join and what non-members see.</p>
        {user === null ? <Link href="/login?next=/community%23start" className="btn-primary mt-4 inline-block !px-4 !py-2 text-xs">Sign in to start one</Link> : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-slate">Name<input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Grace Chapel Lekki" className={`${field} mt-1`} /></label>
            <label className="text-xs text-slate">Address<span className="mt-1 flex items-center gap-1 text-sm text-ink">/c/<input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder={cleanSlug(name) || "grace-chapel-lekki"} maxLength={40} className={field} /></span></label>
            <label className="text-xs text-slate sm:col-span-2">One line about you<input value={tagline} onChange={(e) => setTagline(e.target.value)} maxLength={140} placeholder="A family church in Lekki. Sundays 8am and 10am." className={`${field} mt-1`} /></label>
            <div className="sm:col-span-2"><button className="btn-primary !px-4 !py-2 text-xs" disabled={busy || name.trim().length < 3} onClick={create}>{busy ? "Starting…" : "Start the community"}</button>{err && <span className="ml-3 text-sm text-crimson" role="alert">{err}</span>}</div>
          </div>
        )}
      </section>
    </div>
  );
}

function Grid({ list }: { list: Row[] }) {
  return (
    <ul className="mt-4 grid gap-3 sm:grid-cols-2">
      {list.map((c) => (
        <li key={c.id}><Link href={`/c/${c.id}`} className="card flex items-center gap-3 p-4 hover:border-crimson">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={c.avatar || DEFAULT_AVATAR} alt="" className="h-12 w-12 rounded-xl object-cover" />
          <span className="min-w-0 flex-1"><span className="block truncate font-ui text-sm font-bold text-ink">{c.name}{c.verified ? " ✔" : ""}</span><span className="block truncate text-xs text-slate">{c.tagline}</span><span className="text-xs text-slate">{c.memberCount.toLocaleString()} members{c.status === "pending" ? " · request sent" : c.status === "active" ? " · joined" : ""}</span></span>
        </Link></li>
      ))}
    </ul>
  );
}
