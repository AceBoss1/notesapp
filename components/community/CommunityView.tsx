"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { DEFAULT_AVATAR } from "@/lib/admin";
import { can, roleName, type Role, type Tab, type PublicView, type Space } from "@/lib/community";
import { capi, field, small } from "./api";
import Feed from "./Feed";
import Members, { Circles, useMembers } from "./Members";
import Admin from "./Admin";
import { RoomScreen, RoomsCard } from "./AudioRoom";
import { EventList, NewEventButton } from "@/components/events/Events";

// A community (/c/<id>), as this person's role lets them see it (lib/community-server.ts viewCommunity): non-members get the home page
// and whatever the admins chose to show (General with slow mode, About, Contact, public events, the member list, a Join button); members
// get the whole group; admins get the admin tools and "View as" a non-member, member, moderator or admin.
type View = {
  community: {
    id: string; name: string; tagline: string; avatar: string; cover: string; joinMode: string; questions: string[]; memberCount: number; verified: boolean;
    slowModeSec: number; spaces: Space[]; about: string; contact: string; ownerName: string; ownerUsername: string; publicView?: PublicView; allSpaces?: Space[];
    inviteCode?: string; circlesAllowed: boolean; memberLimit: number | null;
  };
  notice: string; role: Role | null; realRole: Role | null; status: string | null; viewingAs: boolean; tabs: Tab[];
  channels: { id: string; name: string; canPost: boolean }[]; canJoin: boolean;
};
const TAB_NAMES: Record<Tab, string> = { home: "Home", general: "General", spaces: "Spaces", events: "Events", members: "Members", about: "About", contact: "Contact", circles: "Circles", admin: "Admin" };

export default function CommunityView({ id }: { id: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [v, setV] = useState<View | null>(null);
  const [err, setErr] = useState("");
  const [as, setAs] = useState("");
  const [room, setRoom] = useState<{ id: string; title?: string } | null>(null); // an audio room I'm in (components/community/AudioRoom.tsx)
  const tab = (params.get("tab") as Tab) || "home";
  const invite = params.get("invite") ?? "";
  const load = useCallback(async () => {
    try { setV(await capi<View>(`/api/community?id=${id}${as ? `&as=${as}` : ""}`)); setErr(""); }
    catch (e) { setErr(e instanceof Error ? e.message : "Couldn't load the community."); }
  }, [id, as]);
  useEffect(() => onAuthStateChanged(auth, (u) => setUser(u)), []);
  useEffect(() => { if (user !== undefined) load(); }, [user, load]);
  if (err) return <div className="mx-auto max-w-3xl px-4 py-16"><p className="card p-6 text-sm text-crimson">{err}</p></div>;
  if (!v) return <div className="mx-auto max-w-5xl px-4 py-16 text-sm text-slate">Loading…</div>;
  const c = v.community;
  const go = (t: Tab) => router.replace(`/c/${id}?tab=${t}${invite ? `&invite=${invite}` : ""}`, { scroll: false });
  const shownTab: Tab = v.tabs.includes(tab) ? tab : "home";
  const spaceChannels = v.channels.filter((ch) => ch.id !== "general");

  return (
    <div>
      <div className="mx-auto max-w-5xl px-4 pt-6 sm:px-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {c.cover ? <img src={c.cover} alt="" className="aspect-[3/1] w-full rounded-2xl object-cover sm:aspect-[4/1]" /> : <div className="aspect-[5/1] w-full rounded-2xl" style={{ backgroundImage: "linear-gradient(120deg, #4E0119 0%, #7A0328 60%, #A6093D 100%)" }} />}
        <div className="flex flex-col gap-4 px-2 sm:flex-row sm:px-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={c.avatar || DEFAULT_AVATAR} alt="" className="-mt-12 h-24 w-24 shrink-0 rounded-2xl border-4 border-paper bg-paper object-cover shadow-sm" />
          <div className="min-w-0 flex-1 sm:pt-3">
            <h1 className="font-display text-3xl text-ink sm:text-4xl">{c.name}{c.verified && <span className="ml-2 align-middle text-base text-crimson" title="Verified">✔</span>}</h1>
            {c.tagline && <p className="mt-1 text-slate">{c.tagline}</p>}
            <p className="mt-1 text-xs text-slate">{c.memberCount.toLocaleString()} {c.memberCount === 1 ? "member" : "members"} · run by <Link href={`/u/${c.ownerUsername}`} className="underline">{c.ownerName}</Link>{v.realRole ? ` · you're ${v.realRole === "member" ? "a member" : `${v.realRole === "admin" || v.realRole === "owner" ? "an" : "a"} ${roleName(v.realRole).toLowerCase()}`}` : ""}</p>
          </div>
          <div className="sm:pt-4"><JoinBox v={v} user={user ?? null} invite={invite} onChange={load} /></div>
        </div>
        {v.notice && <p className="mt-4 rounded-xl border border-rule bg-card px-4 py-2 text-xs text-slate">⚠ {v.notice}</p>}
        {can(v.realRole, "view_as") && (
          <label className="mt-4 flex items-center gap-2 text-xs text-slate">View as
            <select value={as} onChange={(e) => setAs(e.target.value)} className="rounded-lg border border-rule bg-card px-2 py-1 text-ink">
              <option value="">Myself ({roleName(v.realRole!)})</option><option value="nonmember">A non-member</option><option value="member">A member</option><option value="moderator">A moderator</option>{v.realRole === "owner" && <option value="admin">An admin</option>}
            </select>
            {v.viewingAs && <span className="font-semibold text-crimson">Previewing — nothing you do here changes your role.</span>}
          </label>
        )}
        <nav className="mt-5 flex gap-1 overflow-x-auto border-b border-rule" aria-label="Community">
          {v.tabs.map((t) => <button key={t} onClick={() => go(t)} className={`shrink-0 border-b-2 px-3 py-2 text-sm font-semibold ${shownTab === t ? "border-crimson text-ink" : "border-transparent text-slate hover:text-ink"}`}>{TAB_NAMES[t]}</button>)}
        </nav>
      </div>
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {shownTab === "home" && <Home v={v} as={as} me={user?.uid ?? null} go={go} onRoom={(rid, title) => setRoom({ id: rid, title })} />}
        {room && user && <RoomScreen id={room.id} title={room.title} me={user.uid} onDone={() => setRoom(null)} />}
        {shownTab === "general" && <Feed cid={id} channel="general" canPost={!v.viewingAs && !!v.channels.find((ch) => ch.id === "general")?.canPost} role={v.role} me={user?.uid ?? null} as={as} slowModeSec={c.slowModeSec} />}
        {shownTab === "spaces" && <SpacesTab v={v} id={id} as={as} me={user?.uid ?? null} channels={spaceChannels} />}
        {shownTab === "events" && <div>{can(v.role, "events") && !v.viewingAs && <NewEventButton cid={id} onSaved={load} />}<EventList query={`cid=${id}`} empty="No upcoming events." /></div>}
        {shownTab === "members" && <Members cid={id} role={v.viewingAs ? null : v.role} me={user?.uid ?? null} as={as} />}
        {shownTab === "about" && <p className="card whitespace-pre-line p-6 text-sm text-ink">{c.about}</p>}
        {shownTab === "contact" && <p className="card whitespace-pre-line p-6 text-sm text-ink">{c.contact}</p>}
        {shownTab === "circles" && <Circles cid={id} role={v.viewingAs ? null : v.role} allowed={c.circlesAllowed} as={as} me={user?.uid ?? null} />}
        {shownTab === "admin" && v.role && <Admin cid={id} role={v.role} questions={c.questions} inviteCode={c.inviteCode} onSaved={load}
          initial={c.publicView ? { name: c.name, tagline: c.tagline, about: c.about, contact: c.contact, avatar: c.avatar, cover: c.cover, joinMode: c.joinMode, questions: c.questions, publicView: c.publicView, slowModeSec: c.slowModeSec, spaces: c.allSpaces ?? c.spaces } : null} />}
      </div>
    </div>
  );
}

// Join, ask to join (with the join questions), the invite link, or leave.
function JoinBox({ v, user, invite, onChange }: { v: View; user: User | null; invite: string; onChange: () => void }) {
  const c = v.community;
  const [answers, setAnswers] = useState<string[]>(c.questions.map(() => ""));
  const [asking, setAsking] = useState(false);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);
  const act = async (body: Record<string, unknown>) => { setErr(""); try { await capi("/api/community", { id: c.id, ...body }); setAsking(false); onChange(); } catch (e) { setErr(e instanceof Error ? e.message : "Couldn't do that."); } };
  if (v.realRole) {
    return (
      <div className="flex flex-wrap gap-2">
        {c.inviteCode && <button className={small} onClick={() => { navigator.clipboard?.writeText(`${window.location.origin}/c/${c.id}?invite=${c.inviteCode}`); setCopied(true); }}>{copied ? "Link copied" : "Invite people"}</button>}
        {v.realRole !== "owner" && <button className={small} onClick={() => confirm(`Leave ${c.name}?`) && act({ action: "leave" })}>Leave</button>}
      </div>
    );
  }
  if (v.status === "pending") return <p className="text-sm font-semibold text-slate">Asked to join · waiting for an admin</p>;
  if (v.status === "banned") return null;
  if (!user) return <Link href={`/login?next=${encodeURIComponent(`/c/${c.id}${invite ? `?invite=${invite}` : ""}`)}`} className="btn-primary !px-4 !py-2 text-xs">Sign in to join</Link>;
  const invited = !!invite;
  if (!invited && !v.canJoin) return c.joinMode === "invite" ? <p className="text-xs text-slate">By invitation</p> : null;
  const needsAnswers = c.joinMode === "approval" && !invited && c.questions.length > 0;
  return (
    <div className="max-w-sm">
      {!asking ? (
        <button className="btn-primary !px-4 !py-2 text-xs" onClick={() => (needsAnswers ? setAsking(true) : act({ action: "join", invite }))}>{c.joinMode === "approval" && !invited ? "Ask to join" : "Join"}</button>
      ) : (
        <div className="card p-3">
          {c.questions.map((q, i) => <label key={i} className="mb-2 block text-xs text-slate">{q}<input value={answers[i]} maxLength={300} onChange={(e) => setAnswers(answers.map((a, j) => (j === i ? e.target.value : a)))} className={`${field} mt-1`} /></label>)}
          <button className="btn-primary !px-4 !py-1.5 text-xs" disabled={answers.some((a) => !a.trim())} onClick={() => act({ action: "join", answers })}>Send my request</button>
        </div>
      )}
      {err && <p className="mt-2 text-xs text-crimson" role="alert">{err}</p>}
    </div>
  );
}

function Home({ v, as, me, go, onRoom }: { v: View; as: string; me: string | null; go: (t: Tab) => void; onRoom: (id: string, title?: string) => void }) {
  const c = v.community;
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr,20rem]">
      <div className="space-y-6">
        {!!v.role && !v.viewingAs && me && <RoomsCard cid={c.id} canHost={can(v.role, "rooms")} onOpen={onRoom} />}
        {v.tabs.includes("general") ? (
          <>
            <div className="flex items-center justify-between"><p className="font-ui text-sm font-bold text-ink">General · announcements</p><button className="text-xs text-crimson underline" onClick={() => go("general")}>See all</button></div>
            <Feed cid={c.id} channel="general" canPost={!v.viewingAs && !!v.channels.find((ch) => ch.id === "general")?.canPost} role={v.role} me={me} as={as} slowModeSec={0} />
          </>
        ) : <p className="card p-6 text-sm text-slate">{v.role ? "Welcome." : "Join to see what members share."}</p>}
      </div>
      <aside className="space-y-4">
        <div className="card p-4">
          <p className="font-ui text-sm font-bold text-ink">About</p>
          {c.about && <p className="mt-1 line-clamp-6 whitespace-pre-line text-sm text-slate">{c.about}</p>}
          <ul className="mt-3 space-y-2 text-sm text-ink">
            <li className="flex gap-2"><span aria-hidden>{c.joinMode === "open" ? "🌍" : "🔒"}</span><span><b>{c.joinMode === "open" ? "Open" : c.joinMode === "approval" ? "Members approved" : "By invitation"}</b><span className="block text-xs text-slate">{c.joinMode === "open" ? "Anyone can join." : c.joinMode === "approval" ? "Anyone can ask to join; admins approve." : "Only people with an invite link can join."}</span></span></li>
            <li className="flex gap-2"><span aria-hidden>👥</span><span><b>{c.memberCount.toLocaleString()}</b> {c.memberCount === 1 ? "member" : "members"}</span></li>
            <li className="flex gap-2"><span aria-hidden>⭐</span><span>Run by <Link href={`/u/${c.ownerUsername}`} className="font-semibold hover:underline">{c.ownerName}</Link>{c.verified ? " ✔" : ""}</span></li>
          </ul>
          {v.tabs.includes("about") && <button className="mt-3 w-full rounded-lg bg-paper py-2 font-ui text-xs font-semibold text-ink hover:bg-rule/40" onClick={() => go("about")}>Read more</button>}
        </div>
        {v.tabs.includes("members") && <MembersPreview cid={c.id} as={as} count={c.memberCount} onAll={() => go("members")} />}
        {v.tabs.includes("events") && <div className="card p-4"><p className="font-ui text-sm font-bold text-ink">Upcoming events</p><EventList query={`cid=${c.id}`} empty="No upcoming events." /></div>}
        {c.spaces.length > 0 && <div className="card p-4"><p className="font-ui text-sm font-bold text-ink">Spaces</p><ul className="mt-1 text-sm text-slate">{c.spaces.map((s) => <li key={s.id}>{s.name}{s.visibility === "members" ? " · members only" : ""}</li>)}</ul></div>}
      </aside>
    </div>
  );
}

function SpacesTab({ v, id, as, me, channels }: { v: View; id: string; as: string; me: string | null; channels: { id: string; name: string; canPost: boolean }[] }) {
  const [sel, setSel] = useState(channels[0]?.id ?? "");
  if (!channels.length) return <p className="card p-6 text-sm text-slate">{v.role ? "No Spaces yet." : "This community's Spaces are for members."}</p>;
  const ch = channels.find((x) => x.id === sel) ?? channels[0];
  const vis = v.community.spaces.find((s) => s.id === ch.id)?.visibility;
  return (
    <div>
      <div className="flex flex-wrap gap-2">{channels.map((x) => <button key={x.id} onClick={() => setSel(x.id)} className={`rounded-full border px-3 py-1 text-xs font-semibold ${x.id === ch.id ? "border-crimson bg-crimson text-paper" : "border-rule text-ink"}`}>{x.name}</button>)}</div>
      <p className="mt-2 text-xs text-slate">{vis === "members" ? "Members only: never shown outside the community." : "Public: anyone can read it."}</p>
      <div className="mt-4"><Feed cid={id} channel={ch.id} canPost={!v.viewingAs && ch.canPost} role={v.role} me={me} as={as} slowModeSec={v.community.slowModeSec} /></div>
    </div>
  );
}

// The faces of the people in it, like a group's members card.
function MembersPreview({ cid, as, count, onAll }: { cid: string; as: string; count: number; onAll: () => void }) {
  const { list } = useMembers(cid, as);
  if (!list?.length) return null;
  return (
    <div className="card p-4">
      <p className="font-ui text-sm font-bold text-ink">Members · {count.toLocaleString()}</p>
      <ul className="mt-3 grid grid-cols-4 gap-3">
        {list.slice(0, 8).map((m) => (
          <li key={m.uid} className="text-center">
            <Link href={`/u/${m.username}`} title={m.displayName}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.avatar || DEFAULT_AVATAR} alt="" className="mx-auto h-12 w-12 rounded-full object-cover" />
              <span className="mt-1 block truncate text-[11px] text-slate">{m.displayName.split(" ")[0]}</span>
            </Link>
          </li>
        ))}
      </ul>
      <button className="mt-3 w-full rounded-lg bg-paper py-2 font-ui text-xs font-semibold text-ink hover:bg-rule/40" onClick={onAll}>See all members</button>
    </div>
  );
}
