"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Masked } from "@/components/admin/Masked";
import { NameBadgeIcons } from "@/components/PersonName";
import { badgesOf } from "@/lib/name-badges";
import { useAdminAuth } from "@/lib/useAdminAuth";
import { getAllUsersForAdmin, UserProfile, UserRole, AccountTier } from "@/lib/users";
import { SUSPENSION_LENGTHS, describeUntil, type SuspensionLength } from "@/lib/suspension-length";
import { getAllBadgeRequests, resolveBadgeRequest, getAllSuspensions, suspendUser, unsuspendUser, rejectAppeal, updateUserRole, updateUserTier, setGoldBadge, resolveTierRequest } from "@/lib/moderation";
import { GOLD_KIND_LABEL, GOLD_KIND_LIVE, GoldBadgeKind } from "@/lib/badges";
import { TIERS } from "@/lib/tiers";
import { ADMIN_PROFILES } from "@/lib/admin";
import { hasAnyDept, hasDept } from "@/lib/admin-access";
import { INDUSTRY_LABEL, headline, industryMix, isIndustry } from "@/lib/profile-work";
import { PAGE_SIZE, USER_FILTERS, USER_SORTS, duplicateMap, filterCounts, filterUsers, isUserFilter, isUserSort, type UserFilter, type UserSort } from "@/lib/admin-user-search";
import MemberPanel, { ago, membersCall } from "@/components/admin/users/MemberPanel";
import ReasonDialog from "@/components/admin/users/ReasonDialog";

const FOUNDER_USERNAMES = Object.values(ADMIN_PROFILES).map((p) => p.username);

const ASSIGNABLE_ROLES: { value: UserRole; label: string }[] = [
  { value: "reader", label: "Reader" },
  { value: "staff", label: "Staff (in-house writer)" },
  { value: "volunteer", label: "Volunteer (contributing writer)" },
];

export default function AdminUsersPage() {
  const { user, access, loading } = useAdminAuth();
  const canMoney = hasDept(access, "finance"); // tiers and roles
  const canCare = hasAnyDept(access, ["support", "moderation"]); // gold badges, suspensions
  const canEmails = hasAnyDept(access, ["support"]); // account emails (lib/admin-members-server.ts resendVerification)
  const [users, setUsers] = useState<UserProfile[] | null>(null);
  const [error, setError] = useState("");
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [sharedEmail, setSharedEmail] = useState<Record<string, number>>({});
  const [badgeRequests, setBadgeRequests] = useState<Awaited<ReturnType<typeof getAllBadgeRequests>>>({});
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [suspendReasonFor, setSuspendReasonFor] = useState<string | null>(null);
  const [suspendReason, setSuspendReason] = useState("");
  const [suspendLength, setSuspendLength] = useState<SuspensionLength>("1w");
  // Finding members (lib/admin-user-search.ts): the search, filter, plan and order live in the address (?q=&f=&tier=&sort=&member=) so a
  // link opens the same view; 50 shown at a time.
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<UserFilter>("all");
  const [tierFilter, setTierFilter] = useState("");
  const [sort, setSort] = useState<UserSort>("newest");
  const [shown, setShown] = useState(PAGE_SIZE);
  const [signals, setSignals] = useState<Record<string, { verified: boolean; providers: string[]; lastSignIn?: string; lastSeen?: string; disabled?: boolean; notDuplicateOf?: string[] }>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [panel, setPanel] = useState<string | null>(null);
  const [finding, setFinding] = useState(false);
  const [findEmail, setFindEmail] = useState("");
  const [findError, setFindError] = useState("");
  const [bulk, setBulk] = useState<"message" | "suspend" | "tier" | null>(null);
  const [bulkTier, setBulkTier] = useState<AccountTier>("pro");
  const [bulkText, setBulkText] = useState("");
  const [bulkNote, setBulkNote] = useState("");
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setQ(p.get("q") ?? "");
    const f = p.get("f"); if (isUserFilter(f)) setFilter(f);
    setTierFilter(p.get("tier") ?? "");
    const so = p.get("sort"); if (isUserSort(so)) setSort(so);
    const open = p.get("member"); if (open) setPanel(open);
  }, []);
  useEffect(() => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (filter !== "all") p.set("f", filter);
    if (tierFilter) p.set("tier", tierFilter);
    if (sort !== "newest") p.set("sort", sort);
    if (panel) p.set("member", panel);
    const qs = p.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
    setShown(PAGE_SIZE);
  }, [q, filter, tierFilter, sort, panel]);

  const mix = useMemo(() => (users ? industryMix(users) : null), [users]);
  // Possible duplicates, less the pairs staff marked as different people.
  const dups = useMemo(() => {
    const m = users ? duplicateMap(users, sharedEmail, headline) : new Map<string, { other: UserProfile; why: "same email as" | "same name and work as" }[]>();
    for (const [uid, l] of Array.from(m.entries())) {
      const keep = l.filter((x) => !(signals[uid]?.notDuplicateOf ?? []).includes(x.other.uid));
      if (keep.length) m.set(uid, keep); else m.delete(uid);
    }
    return m;
  }, [users, sharedEmail, signals]);
  const ctx = useMemo(() => ({ emails, badgePending: new Set(Object.entries(badgeRequests).filter(([, r]) => r?.status === "pending").map(([k]) => k)), duplicates: new Set(Array.from(dups.keys())) }), [emails, badgeRequests, dups]);
  const list = useMemo(() => (users ? filterUsers(users, { q, filter, tier: tierFilter, sort }, ctx) : []), [users, q, filter, tierFilter, sort, ctx]);
  const counts = useMemo(() => (users ? filterCounts(users, { q, tier: tierFilter }, ctx) : null), [users, q, tierFilter, ctx]);
  // The strip at the top: everyone, by plan, new this week and month, and what's waiting on us.
  const summary = useMemo(() => {
    if (!users) return null;
    const now = Date.now(), within = (d: number) => users.filter((u) => u.createdAt && now - Date.parse(u.createdAt) < d * 86_400_000).length;
    const byTier = TIERS.map((t) => ({ tier: t.tier, label: t.label, n: users.filter((u) => (u.accountTier ?? "standard") === t.tier).length }));
    const known = users.filter((u) => signals[u.uid]).length, verified = users.filter((u) => signals[u.uid]?.verified).length;
    return { total: users.length, week: within(7), month: within(30), byTier, suspended: users.filter((u) => u.suspended).length, verifiedPct: known ? Math.round((verified / known) * 100) : null };
  }, [users, signals]);

  function reload() {
    getAllUsersForAdmin()
      .then(async (rawList) => {
        const suspensions = await getAllSuspensions().catch(() => ({}) as Record<string, UserProfile["suspension"]>);
        const list = rawList.map((u) => ({ ...u, suspension: suspensions[u.uid] ?? u.suspension }));
        setUsers(list);
        getAllBadgeRequests().then(setBadgeRequests).catch(() => {});
        // Emails come from Firebase Auth via an admin-only endpoint, masked; Show reveals one with a logged reason.
        try {
          const res = await fetch("/api/admin/user-emails", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user!.getIdToken()}` },
            body: JSON.stringify({ uids: list.map((u) => u.uid) }),
          });
          if (res.ok) {
            const j = await res.json();
            setEmails(j.emails || {});
            setSharedEmail(j.sharedEmail || {});
          }
          // Email confirmed, sign-in method, last signed in and seen (lib/admin-members-server.ts signals).
          membersCall<{ signals: typeof signals }>(user!, { body: { action: "signals", uids: list.map((u) => u.uid) } }).then((j) => setSignals(j.signals)).catch(() => {});
        } catch {
          /* emails are a convenience; the list still works without them */
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load users"));
  }

  useEffect(() => {
    if (!user) return;
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (loading || !user) {
    return <div className="px-6 py-24 text-center text-slate">Loading…</div>;
  }

  // Every change made here goes in the member's history (lib/admin-members-server.ts logChange), stamped on the server with who and when.
  function logged(uid: string, what: string, detail: string) {
    if (user) void membersCall(user, { body: { action: "history", uid, what, detail } }).catch(() => {});
  }
  const nameOf = (uid: string) => users?.find((x) => x.uid === uid);

  async function findByEmail(reason: string, note: string) {
    if (!user) return;
    setFindError("");
    try {
      const r = await fetch("/api/admin/reveal", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` }, body: JSON.stringify({ find: "email", email: findEmail, reason, note }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Couldn't look it up.");
      setFinding(false); setFindEmail(""); setFilter("all"); setQ(j.uid); setPanel(j.uid);
    } catch (e) { setFindError(e instanceof Error ? e.message : "Couldn't look it up."); }
  }

  async function bulkSend() {
    if (!user || !selected.size) return;
    setBusyUid("bulk");
    try {
      if (bulk === "message") {
        await membersCall(user, { body: { action: "notify", uids: Array.from(selected), message: bulkText } });
      } else if (bulk === "suspend") {
        for (const uid of Array.from(selected)) {
          const m = nameOf(uid);
          if (!m || m.suspended || FOUNDER_USERNAMES.includes(m.username)) continue;
          await suspendUser(uid, m.username, bulkText.trim(), user.uid, suspendLength);
          logged(uid, "suspended", `${bulkText.trim()} (${suspendLength}, with ${selected.size - 1} others)`);
        }
      }
      setBulkNote(bulk === "message" ? `Sent to ${selected.size}.` : `Suspended the ones that weren't already.`);
      setBulk(null); setBulkText(""); setSelected(new Set()); reload();
    } catch (e) { setBulkNote(e instanceof Error ? e.message : "Something went wrong."); } finally { setBusyUid(null); }
  }

  // More things to do to everyone selected (owner, 22 Nov 2026: "upgrade tier, suspend, resend verification email etc"). Founders are
  // never in a selection; each one is logged in the member's history like a single change.
  const picked = () => Array.from(selected).map((uid) => nameOf(uid)).filter((m): m is UserProfile => !!m && !FOUNDER_USERNAMES.includes(m.username));
  async function bulkTierSet() {
    if (!user) return;
    setBusyUid("bulk");
    let n = 0;
    try {
      for (const m of picked()) {
        const from = m.accountTier ?? "standard";
        if (from === bulkTier) continue;
        await updateUserTier(m.uid, bulkTier);
        logged(m.uid, "tier", `${from} → ${bulkTier} (with ${selected.size - 1} others)`);
        n++;
      }
      setBulkNote(`Moved ${n} to ${TIERS.find((t) => t.tier === bulkTier)?.label ?? bulkTier}; the rest were on it already.`);
      setBulk(null); setSelected(new Set()); reload();
    } catch (e) { setBulkNote(`${n} moved, then: ${e instanceof Error ? e.message : "something went wrong."}`); } finally { setBusyUid(null); }
  }
  async function bulkUnsuspend() {
    if (!user) return;
    const them = picked().filter((m) => m.suspended);
    if (!them.length) { setBulkNote("None of them are suspended."); return; }
    if (!confirm(`Unsuspend ${them.length} account${them.length === 1 ? "" : "s"}?`)) return;
    setBusyUid("bulk");
    try {
      for (const m of them) { await unsuspendUser(m.uid, m.username, user.uid, false); logged(m.uid, "unsuspended", `Unsuspended (with ${them.length - 1} others)`); }
      setBulkNote(`Unsuspended ${them.length}.`); setSelected(new Set()); reload();
    } catch (e) { setBulkNote(e instanceof Error ? e.message : "Something went wrong."); } finally { setBusyUid(null); }
  }
  async function bulkVerify() {
    if (!user) return;
    const uids = picked().filter((m) => !signals[m.uid]?.verified).map((m) => m.uid);
    if (!uids.length) { setBulkNote("They have all confirmed their email."); return; }
    if (!confirm(`Send the confirmation email again to ${uids.length} member${uids.length === 1 ? "" : "s"} who haven't confirmed?`)) return;
    setBusyUid("bulk");
    try {
      const r = await membersCall<{ sent: number; skipped: number }>(user, { body: { action: "verifyMany", uids: uids.slice(0, 100) } });
      setBulkNote(`Sent ${r.sent}${r.skipped ? `; skipped ${r.skipped} (already confirmed or no email)` : ""}${uids.length > 100 ? ". At most 100 at a time: send again for the rest." : "."}`);
      setSelected(new Set());
    } catch (e) { setBulkNote(e instanceof Error ? e.message : "Something went wrong."); } finally { setBusyUid(null); }
  }

  async function handleSuspend(uid: string, username: string) {
    if (!suspendReason.trim() || !user) return;
    setBusyUid(uid);
    try {
      await suspendUser(uid, username, suspendReason.trim(), user.uid, suspendLength);
      logged(uid, "suspended", `${suspendReason.trim()} (${suspendLength})`);
      setSuspendReasonFor(null);
      setSuspendReason("");
      reload();
    } finally {
      setBusyUid(null);
    }
  }

  async function handleUnsuspend(uid: string, username: string, upheld: boolean) {
    if (!user) return;
    setBusyUid(uid);
    try {
      await unsuspendUser(uid, username, user.uid, upheld);
      logged(uid, upheld ? "appeal" : "unsuspended", upheld ? "Appeal upheld, unsuspended" : "Unsuspended");
      reload();
    } finally {
      setBusyUid(null);
    }
  }

  async function handleRejectAppeal(uid: string, username: string) {
    if (!user) return;
    setBusyUid(uid);
    try {
      await rejectAppeal(uid, username, user.uid);
      logged(uid, "appeal", "Appeal rejected, stays suspended");
      reload();
    } finally {
      setBusyUid(null);
    }
  }

  async function handleTierRequest(u: UserProfile, approve: boolean) {
    if (!user) return;
    setBusyUid(u.uid);
    try {
      await resolveTierRequest(u.uid, u.username, user.uid, approve);
      logged(u.uid, "basic request", approve ? "Approved" : "Rejected");
      reload();
    } finally {
      setBusyUid(null);
    }
  }

  async function handleBadgeRequest(uid: string, approve: boolean) {
    if (!user) return;
    setBusyUid(uid);
    try {
      // Server-side so the applicant also gets a bell notification and an email.
      let reason: string | undefined;
      if (!approve) {
        const r = window.prompt("Reason for declining (shown to the applicant; optional):");
        if (r === null) return;
        reason = r.trim() || undefined;
      }
      const res = await fetch("/api/admin/badge-request", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` },
        body: JSON.stringify({ uid, approve, reason }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Couldn't record the decision");
      logged(uid, "badge request", approve ? "Approved" : `Declined${reason ? `: ${reason}` : ""}`);
      reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Couldn't record the decision");
    } finally {
      setBusyUid(null);
    }
  }

  async function handleGoldChange(uid: string, value: string) {
    setBusyUid(uid);
    try {
      await setGoldBadge(uid, (value || null) as GoldBadgeKind | null);
      logged(uid, "gold", `${nameOf(uid)?.goldBadge?.kind ?? "none"} → ${value || "none"}`);
      reload();
    } finally {
      setBusyUid(null);
    }
  }

  async function handleTierChange(uid: string, tier: AccountTier) {
    setBusyUid(uid);
    try {
      await updateUserTier(uid, tier);
      logged(uid, "tier", `${nameOf(uid)?.accountTier ?? "standard"} → ${tier}`);
      reload();
    } finally {
      setBusyUid(null);
    }
  }

  async function handleRoleChange(uid: string, username: string, role: UserRole) {
    setBusyUid(uid);
    try {
      await updateUserRole(uid, username, role);
      logged(uid, "role", `${nameOf(uid)?.role ?? "reader"} → ${role}`);
      reload();
    } finally {
      setBusyUid(null);
    }
  }

  return (
    <section className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-14">
      <Link
        href="/admin"
        className="block font-ui text-xs font-semibold uppercase tracking-wideish text-crimson-bright"
      >
        ← Dashboard
      </Link>
      <p className="eyebrow mt-6">
        {users ? `${users.length} Registered` : ""}
      </p>
      <h1 className="font-display text-4xl mt-3">Users</h1>
      <p className="mt-3 text-sm text-slate max-w-xl">
        Everyone who's signed up on the site, including organisation
        accounts and the founder accounts. Shared with Precheks — same
        `users` collection — so anyone who's ever signed up on either site
        shows up here.
      </p>
      <p className="mt-3 text-sm text-slate max-w-xl">
        Publishing: "Staff" and "Volunteer" accounts can publish their own
        notes, and so can any account on a paid or Basic publisher plan.
        Only admins (the founder accounts) can publish for others or change
        site settings. Roles are set here; admin rights come only from the
        admin claim, never from this dropdown.
      </p>

      {error && <p className="mt-6 text-sm text-red-700">{error}</p>}

      {mix && mix.answered > 0 && (
        <section className="card mt-8 p-5" aria-label="What members do">
          <h2 className="font-display text-xl text-ink">What our members do</h2>
          <p className="mt-1 text-xs text-slate">From the optional &ldquo;What do you do?&rdquo; answer at sign-up and in Edit profile: {mix.answered} of {mix.total} members have answered.</p>
          <ul className="mt-3 space-y-2 text-sm">
            {mix.rows.map((r) => (
              <li key={r.key}>
                <div className="flex justify-between gap-2"><span>{r.label}</span><span>{r.count} · {Math.round((r.count / mix.answered) * 100)}%</span></div>
                <div className="mt-1 h-1.5 bg-rule"><div className="h-1.5 bg-crimson" style={{ width: `${(r.count / mix.rows[0].count) * 100}%` }} /></div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {summary && (
        <section className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Members at a glance">
          {[
            { k: "Members", v: summary.total, n: `${summary.week} new this week · ${summary.month} this month` },
            { k: "Waiting on us", v: counts?.action ?? 0, n: "Badge and Basic applications, appeals", on: () => setFilter("action") },
            { k: "Suspended", v: summary.suspended, n: "Accounts suspended now", on: () => setFilter("suspended") },
            { k: "Email confirmed", v: summary.verifiedPct === null ? "…" : `${summary.verifiedPct}%`, n: "Of everyone who signs in with email" },
          ].map((c) => (
            <button key={c.k} type="button" disabled={!c.on} onClick={c.on} className="rounded-[14px] border border-rule bg-card p-4 text-left enabled:hover:border-crimson">
              <span className="block font-ui text-[13px] text-slate">{c.k}</span>
              <span className="block font-display text-2xl text-ink">{c.v}</span>
              <span className="block font-ui text-[11px] text-slate">{c.n}</span>
            </button>
          ))}
          <p className="col-span-2 font-ui text-xs text-slate sm:col-span-4">{summary.byTier.map((t) => `${t.label} ${t.n}`).join(" · ")}</p>
        </section>
      )}

      {users && (
        <div className="sticky top-[4.5rem] z-20 -mx-4 mt-6 border-b border-rule bg-paper/95 px-4 pb-3 pt-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative min-w-0 flex-1 basis-60">
              <span className="sr-only">Search members</span>
              <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, @username, uid, work or email domain" className="w-full rounded-full border border-rule bg-card px-4 py-2.5 font-ui text-sm outline-none focus:border-crimson" />
            </label>
            {canCare || canMoney || hasDept(access, "legal") ? <button type="button" onClick={() => { setFinding(true); setFindError(""); }} className="rounded-full border border-rule bg-card px-4 py-2.5 font-ui text-sm font-semibold text-ink hover:border-crimson">Find by email</button> : null}
            <select aria-label="Plan" value={tierFilter} onChange={(e) => setTierFilter(e.target.value)} className="rounded-full border border-rule bg-card px-3 py-2.5 font-ui text-sm">
              <option value="">Every plan</option>
              {TIERS.map((t) => <option key={t.tier} value={t.tier}>{t.label}</option>)}
            </select>
            <select aria-label="Order" value={sort} onChange={(e) => setSort(e.target.value as UserSort)} className="rounded-full border border-rule bg-card px-3 py-2.5 font-ui text-sm">
              {USER_SORTS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
            </select>
          </div>
          <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1" role="group" aria-label="Show">
            {USER_FILTERS.map((x) => (
              <button key={x.id} type="button" title={x.hint} onClick={() => setFilter(x.id)} aria-pressed={filter === x.id}
                className={`shrink-0 rounded-full px-3 py-1.5 font-ui text-xs font-semibold ${filter === x.id ? "bg-crimson text-paper" : "border border-rule bg-card text-ink hover:border-crimson"} ${x.id === "action" && (counts?.action ?? 0) > 0 && filter !== x.id ? "!border-amber-400 !bg-amber-50" : ""}`}>
                {x.label} <span className="font-mono opacity-80">{counts?.[x.id] ?? 0}</span>
              </button>
            ))}
          </div>
          {selected.size > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl bg-crimson-deep px-3 py-2 font-ui text-sm text-paper">
              <b>{selected.size} selected</b>
              {canCare && <button type="button" onClick={() => { setBulk("message"); setBulkText(""); }} className="rounded-full bg-paper/15 px-3 py-1 font-semibold hover:bg-paper/25">Send a notification</button>}
              {canCare && <button type="button" onClick={() => { setBulk("suspend"); setBulkText(""); }} className="rounded-full bg-paper/15 px-3 py-1 font-semibold hover:bg-paper/25">Suspend</button>}
              {canCare && <button type="button" disabled={busyUid === "bulk"} onClick={() => void bulkUnsuspend()} className="rounded-full bg-paper/15 px-3 py-1 font-semibold hover:bg-paper/25 disabled:opacity-50">Unsuspend</button>}
              {canMoney && <button type="button" onClick={() => setBulk("tier")} className="rounded-full bg-paper/15 px-3 py-1 font-semibold hover:bg-paper/25 disabled:opacity-50">Change plan</button>}
              {canEmails && <button type="button" disabled={busyUid === "bulk"} onClick={() => void bulkVerify()} className="rounded-full bg-paper/15 px-3 py-1 font-semibold hover:bg-paper/25 disabled:opacity-50">Resend confirmation email</button>}
              <button type="button" onClick={() => setSelected(new Set())} className="ml-auto text-paper/80 hover:text-paper">Clear</button>
            </div>
          )}
          {bulk === "tier" && (
            <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-rule bg-card p-3">
              <p className="font-ui text-sm font-semibold text-ink">Move {selected.size} account{selected.size === 1 ? "" : "s"} to</p>
              <select value={bulkTier} onChange={(e) => setBulkTier(e.target.value as AccountTier)} aria-label="Plan" className="rounded-lg border border-rule bg-paper px-2 py-2 text-sm">
                {TIERS.map((t) => <option key={t.tier} value={t.tier}>{t.label}</option>)}
              </select>
              <button type="button" disabled={busyUid === "bulk"} onClick={() => { if (confirm(`Move ${selected.size} accounts to ${TIERS.find((t) => t.tier === bulkTier)?.label}? This changes their plan straight away, without payment.`)) void bulkTierSet(); }} className="rounded-lg bg-crimson px-4 py-2 font-ui text-xs font-semibold text-paper disabled:opacity-50">{busyUid === "bulk" ? "Working…" : "Change plan"}</button>
              <button type="button" onClick={() => setBulk(null)} className="px-2 font-ui text-xs text-slate">Cancel</button>
            </div>
          )}
          {(bulk === "message" || bulk === "suspend") && (
            <div className="mt-2 rounded-xl border border-rule bg-card p-3">
              <p className="font-ui text-sm font-semibold text-ink">{bulk === "message" ? `Notification to ${selected.size} member${selected.size === 1 ? "" : "s"}` : `Suspend ${selected.size} account${selected.size === 1 ? "" : "s"}`}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <input value={bulkText} onChange={(e) => setBulkText(e.target.value)} maxLength={280} placeholder={bulk === "message" ? "The message (they see it in their notifications)" : "Reason (shown to them and in the moderation record)"} className="min-w-0 flex-1 rounded-lg border border-rule bg-paper px-3 py-2 text-sm" />
                {bulk === "suspend" && <select value={suspendLength} onChange={(e) => setSuspendLength(e.target.value as SuspensionLength)} aria-label="How long" className="rounded-lg border border-rule bg-paper px-2 py-2 text-sm">{SUSPENSION_LENGTHS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}</select>}
                <button type="button" disabled={busyUid === "bulk" || bulkText.trim().length < (bulk === "message" ? 5 : 3)} onClick={() => { if (bulk === "message" || confirm(`Suspend ${selected.size} accounts? Admins and accounts already suspended are skipped.`)) void bulkSend(); }} className="rounded-lg bg-crimson px-4 py-2 font-ui text-xs font-semibold text-paper disabled:opacity-50">{busyUid === "bulk" ? "Working…" : bulk === "message" ? "Send" : "Suspend them"}</button>
                <button type="button" onClick={() => setBulk(null)} className="px-2 font-ui text-xs text-slate">Cancel</button>
              </div>
            </div>
          )}
          {bulkNote && <p className="mt-2 font-ui text-xs text-green-700" role="status">{bulkNote}</p>}
        </div>
      )}

      {!users ? (
        <p className="mt-8 text-slate">Loading…</p>
      ) : (
        <>
        <div className="mt-4 flex items-center justify-between gap-3 font-ui text-xs text-slate">
          <span>{list.length === users.length ? `${users.length} members` : `${list.length} of ${users.length} members`}</span>
          {list.length > 0 && <button type="button" onClick={() => setSelected(new Set(list.slice(0, shown).map((u) => u.uid).filter((uid) => !FOUNDER_USERNAMES.includes(nameOf(uid)?.username ?? ""))))} className="font-semibold text-crimson">Select the {Math.min(shown, list.length)} shown</button>}
        </div>
        {list.length === 0 && <p className="mt-6 font-ui text-sm text-slate">No members match. Try fewer words, another filter, or Find by email.</p>}
        <div className="mt-2 divide-y divide-rule">
          {list.slice(0, shown).map((u) => {
            // A shared display name alone is not a duplicate ("David" and "David"): same sign-in email, or same name and work and field
            // (lib/admin-user-search.ts duplicateMap), less the pairs staff marked as different people.
            const dupList = dups.get(u.uid) ?? [];
            const sameName = dupList.map((x) => x.other);
            const why = (o: typeof u) => dupList.find((x) => x.other.uid === o.uid)?.why ?? "same name and work as";
            const sig = signals[u.uid];
            const isFounder = FOUNDER_USERNAMES.includes(u.username);
            const suspended = u.suspended === true;
            const pendingAppeal = suspended && u.suspension?.appealStatus === "pending";

            return (
              <div key={u.uid} className={`py-5 ${selected.has(u.uid) ? "bg-crimson/5" : ""}`}>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                  {!isFounder && (
                    <input type="checkbox" aria-label={`Select ${u.displayName}`} checked={selected.has(u.uid)} className="h-4 w-4 accent-crimson"
                      onChange={(e) => setSelected((cur) => { const n = new Set(cur); if (e.target.checked) n.add(u.uid); else n.delete(u.uid); return n; })} />
                  )}
                  <Link href={`/u/${u.username}`} className="flex items-center gap-3 group">
                    <Image
                      src={suspended ? "/images/brand/suspended-avatar.png" : u.avatar}
                      alt={u.displayName}
                      width={40}
                      height={40}
                      className="rounded-full object-cover w-10 h-10"
                    />
                    <div>
                      <p className="font-ui font-semibold text-ink group-hover:text-crimson-bright">
                        {u.displayName}
                        <NameBadgeIcons username={u.username} size={14} badges={badgesOf(u)} />{" "}
                        <span className="font-mono text-xs text-crimson-bright">
                          @{u.username}
                        </span>
                      </p>
                      <p className="text-xs text-slate mt-0.5"><Masked kind="member-email" subject={u.uid} masked={emails[u.uid]} page="Users" /></p>
                      {sig && (
                        <p className="mt-0.5 font-ui text-[11px] text-slate">
                          {sig.verified ? <span className="text-green-700">✓ email confirmed</span> : <span className="text-amber-700">email not confirmed</span>}
                          {sig.providers.length > 0 && <> · {sig.providers.join(", ")}</>}
                          {" · "}seen {ago(sig.lastSeen ?? sig.lastSignIn)} · {(u.accountTier ?? "standard")}
                          {sig.disabled && <b className="text-red-700"> · sign-in disabled</b>}
                        </p>
                      )}
                      {(headline(u) || isIndustry(u.industry)) && (
                        <p className="mt-0.5 text-xs text-ink">{[headline(u), isIndustry(u.industry) ? INDUSTRY_LABEL[u.industry] : ""].filter(Boolean).join(" · ")}</p>
                      )}
                      {sameName.length > 0 && canCare && (
                        <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (user && confirm(`Mark ${u.displayName} and ${sameName.map((o) => "@" + o.username).join(", ")} as different people? The warning goes away for both.`)) void Promise.all(sameName.map((o) => membersCall(user, { body: { action: "notDuplicate", a: u.uid, b: o.uid } }))).then(() => reload()).catch((err) => alert(err instanceof Error ? err.message : "Couldn't save that.")); }}
                          className="mt-1 block font-ui text-[11px] font-semibold text-crimson underline">Not the same person</button>
                      )}
                      {sameName.length > 0 && (
                        <p className="mt-1 text-xs font-semibold text-amber-800">
                          ⚠ {sameName.map((o) => `${why(o)} @${o.username}`).join(", ").replace(/^./, (c) => c.toUpperCase())} — possible duplicate account (uid {u.uid.slice(0, 8)}…). Older journals saved with only an author name can show on both profiles; suspend or rename the extra account.
                        </p>
                      )}
                    {badgeRequests[u.uid]?.status === "pending" && (
                      <div className="mt-2 border border-amber-200 bg-amber-50 p-2 text-xs text-ink">
                        <p className="font-semibold">Applied for the gold badge ({(badgeRequests[u.uid].kind ?? "endorsement")}, {(badgeRequests[u.uid].track ?? "personal")})</p>
                        {badgeRequests[u.uid].kind === "identity" && (
                          <p className="mt-0.5 text-slate">Deposit paid {badgeRequests[u.uid].depositPaidAt?.slice(0, 10)} — {badgeRequests[u.uid].dojah ? "Dojah's result is below." : "no Dojah result yet (it arrives by webhook)."} Dojah dashboard reference: na_{u.uid}</p>
                        )}
                        {badgeRequests[u.uid].dojah && (
                          <p className={`mt-0.5 font-semibold ${badgeRequests[u.uid].dojah!.passed ? "text-green-700" : badgeRequests[u.uid].dojah!.terminal ? "text-crimson" : "text-slate"}`}>
                            Dojah: {badgeRequests[u.uid].dojah!.verificationStatus} — {badgeRequests[u.uid].dojah!.passed ? "every step passed" : badgeRequests[u.uid].dojah!.terminal ? "needs your review (a step failed or is missing)" : "still in progress"}
                            <span className="ml-2 font-normal text-slate">{Object.entries(badgeRequests[u.uid].dojah!.steps).map(([k, v]) => `${k} ${v ? "✓" : "✗"}`).join(" · ")}{badgeRequests[u.uid].dojah!.unscored?.length ? ` · not scored: ${badgeRequests[u.uid].dojah!.unscored!.join(", ")}` : ""}{badgeRequests[u.uid].dojah!.businessNumber ? ` · CAC lookup found ${badgeRequests[u.uid].dojah!.businessNumber}` : ""}{badgeRequests[u.uid].dojah!.missing?.length ? ` · missing: ${badgeRequests[u.uid].dojah!.missing!.join(", ")}` : ""}</span>
                          </p>
                        )}
                        <p className="mt-0.5 whitespace-pre-line text-slate">“{badgeRequests[u.uid].message}”</p>
                        <div className="mt-1.5 flex gap-2">
                          <button disabled={busyUid === u.uid} onClick={() => handleBadgeRequest(u.uid, true)} className="rounded-full border border-rule px-3 py-0.5 hover:border-crimson hover:text-crimson disabled:opacity-40">Approve (they then pay)</button>
                          <button disabled={busyUid === u.uid} onClick={() => handleBadgeRequest(u.uid, false)} className="rounded-full border border-rule px-3 py-0.5 hover:border-crimson hover:text-crimson disabled:opacity-40">Decline</button>
                        </div>
                      </div>
                    )}
                    {u.tierRequest?.status === "pending" && (
                      <div className="mt-2 border border-amber-200 bg-amber-50 p-2 text-xs text-ink">
                        <p className="font-semibold">Applied for Free Basic</p>
                        <p className="mt-0.5 text-slate">“{u.tierRequest.message}”</p>
                        <div className="mt-1.5 flex gap-2">
                          <button disabled={busyUid === u.uid} onClick={() => handleTierRequest(u, true)} className="rounded-full border border-rule px-3 py-0.5 hover:border-crimson hover:text-crimson disabled:opacity-40">Approve</button>
                          <button disabled={busyUid === u.uid} onClick={() => handleTierRequest(u, false)} className="rounded-full border border-rule px-3 py-0.5 hover:border-crimson hover:text-crimson disabled:opacity-40">Reject</button>
                        </div>
                      </div>
                    )}
                    </div>
                  </Link>
                  </div>

                  <div className="flex items-center gap-3 flex-wrap">
                    {suspended && (
                      <span className="text-[10px] font-mono uppercase tracking-wide px-2 py-0.5 bg-red-100 text-red-800">
                        Suspended
                      </span>
                    )}
                    {isFounder ? (
                      <span className="text-[10px] font-mono uppercase tracking-wide px-2 py-0.5 bg-crimson/10 text-crimson-bright">
                        admin
                      </span>
                    ) : (
                      <>
                      {canCare && <select
                        title="Gold badge (endorsement is live; identity check is coming soon and stays hidden)"
                        value={u.goldBadge?.kind || ""}
                        disabled={busyUid === u.uid}
                        onChange={(e) => handleGoldChange(u.uid, e.target.value)}
                        className="border border-rule bg-card px-2 py-1 font-mono text-xs disabled:opacity-50"
                      >
                        <option value="">No gold</option>
                        {(Object.keys(GOLD_KIND_LABEL) as GoldBadgeKind[]).filter((k) => GOLD_KIND_LIVE[k] || u.goldBadge?.kind === k).map((k) => (
                          <option key={k} value={k}>
                            Gold: {GOLD_KIND_LABEL[k]}
                          </option>
                        ))}
                      </select>}
                      {canMoney && <select
                        title="Account tier"
                        value={u.accountTier || "standard"}
                        disabled={busyUid === u.uid}
                        onChange={(e) => handleTierChange(u.uid, e.target.value as AccountTier)}
                        className="border border-rule bg-card px-2 py-1 font-mono text-xs disabled:opacity-50"
                      >
                        {TIERS.map((t) => (
                          <option key={t.tier} value={t.tier}>
                            {t.label}
                          </option>
                        ))}
                      </select>}
                      {canMoney && <select
                        value={u.role}
                        disabled={busyUid === u.uid}
                        onChange={(e) => handleRoleChange(u.uid, u.username, e.target.value as UserRole)}
                        className="border border-rule bg-card px-2 py-1 font-mono text-xs disabled:opacity-50"
                      >
                        {ASSIGNABLE_ROLES.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </select>}
                      </>
                    )}
                    <button type="button" onClick={() => setPanel(u.uid)} className="rounded-full bg-crimson px-3 py-1.5 font-ui text-xs font-semibold text-paper hover:bg-crimson-bright">Details</button>
                    <p className="text-xs text-slate font-mono" title="Joined">
                      {new Date(u.createdAt).toLocaleDateString("en-NG", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                    {!isFounder && canCare &&
                      (suspended ? (
                        <button
                          onClick={() => handleUnsuspend(u.uid, u.username, false)}
                          disabled={busyUid === u.uid}
                          className="border border-rule px-3 py-1.5 font-ui text-xs font-semibold hover:border-crimson disabled:opacity-50"
                        >
                          Unsuspend
                        </button>
                      ) : (
                        <button
                          onClick={() =>
                            setSuspendReasonFor(suspendReasonFor === u.uid ? null : u.uid)
                          }
                          className="border border-rule px-3 py-1.5 font-ui text-xs font-semibold hover:border-crimson"
                        >
                          Suspend
                        </button>
                      ))}
                  </div>
                </div>

                {suspendReasonFor === u.uid && (
                  <div className="mt-3 flex gap-2">
                    <input
                      value={suspendReason}
                      onChange={(e) => setSuspendReason(e.target.value)}
                      placeholder="Reason (shown in the moderation record)"
                      className="flex-1 border border-rule bg-card px-3 py-2 text-sm focus:border-crimson outline-none"
                    />
                    <select value={suspendLength} onChange={(e) => setSuspendLength(e.target.value as SuspensionLength)} aria-label="How long" className="border border-rule bg-card px-2 py-2 text-sm">
                      {SUSPENSION_LENGTHS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
                    </select>
                    <button
                      onClick={() => handleSuspend(u.uid, u.username)}
                      disabled={busyUid === u.uid || !suspendReason.trim()}
                      className="bg-crimson text-paper font-ui text-xs font-semibold px-4 py-2 hover:bg-crimson-bright transition-colors disabled:opacity-50"
                    >
                      Confirm Suspend
                    </button>
                  </div>
                )}

                {suspended && u.suspension && (
                  <div className="mt-3 rounded-lg bg-paper p-4 text-sm">
                    <p className="text-slate">
                      <span className="font-semibold text-ink">Reason:</span> {u.suspension.reason} · <span className="font-semibold text-ink">Length:</span> {u.suspension.until ? describeUntil(u.suspension.until) : "until lifted"}
                    </p>
                    {pendingAppeal && (
                      <div className="mt-3 border-t border-rule pt-3">
                        <p className="font-semibold text-ink">Appeal submitted:</p>
                        <p className="mt-1 text-slate">&ldquo;{u.suspension.appealText}&rdquo;</p>
                        <div className="mt-3 flex gap-2">
                          <button
                            onClick={() => handleUnsuspend(u.uid, u.username, true)}
                            disabled={busyUid === u.uid}
                            className="bg-crimson text-paper font-ui text-xs font-semibold px-4 py-2 hover:bg-crimson-bright transition-colors disabled:opacity-50"
                          >
                            Uphold — Unsuspend
                          </button>
                          <button
                            onClick={() => handleRejectAppeal(u.uid, u.username)}
                            disabled={busyUid === u.uid}
                            className="border border-rule px-4 py-2 font-ui text-xs font-semibold hover:border-crimson disabled:opacity-50"
                          >
                            Reject — Stays Suspended
                          </button>
                        </div>
                      </div>
                    )}
                    {u.suspension.appealStatus === "rejected" && (
                      <p className="mt-2 font-mono text-xs text-slate">Appeal rejected — status quo remains.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {list.length > shown && <button type="button" onClick={() => setShown((n) => n + PAGE_SIZE)} className="mt-6 w-full rounded-full border border-rule bg-card py-3 font-ui text-sm font-semibold text-ink hover:border-crimson">Show {Math.min(PAGE_SIZE, list.length - shown)} more ({list.length - shown} left)</button>}
        </>
      )}

      {panel && user && <MemberPanel user={user} uid={panel} onClose={() => setPanel(null)} onChanged={reload} />}
      {finding && (
        <ReasonDialog title="Find a member by email" note="Enter their whole email address. Only the account comes back; your name, the time and your reason go in the view log." action="Find" busy={false} error={findError}
          ready={/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(findEmail.trim())} onCancel={() => setFinding(false)} onSubmit={(r, n) => void findByEmail(r, n)}>
          <label className="mt-4 block font-ui text-xs font-semibold text-ink">Email
            <input type="email" autoFocus value={findEmail} onChange={(e) => setFindEmail(e.target.value)} placeholder="name@example.com" className="mt-1 w-full rounded-xl border border-rule bg-paper px-3 py-2 text-sm font-normal" />
          </label>
        </ReasonDialog>
      )}
    </section>
  );
}
