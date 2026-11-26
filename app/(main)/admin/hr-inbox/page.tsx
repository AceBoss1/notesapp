"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAdminAuth } from "@/lib/useAdminAuth";
import { useAdminCall } from "@/lib/useAdminCall";
import Avatar from "@/components/Avatar";
import { ApplicationThread } from "@/components/ApplicationThread";
import { HR_INBOX_FILTERS, filterRows, type HrInboxFilter, type HrInboxRow } from "@/lib/hr-inbox";

// Admin → #Nana-HR inbox. Owner, 26 Nov 2026: "Admin → #Nana-HR inbox: HR reads and answers replies there." Every conversation on an
// application to #NotesApp's own roles, newest activity first, beside the open one (stacked on phones), for super admins and the Chief
// of Staff (lib/admin-access.ts HR_INBOX_NEED). Answers go out as HR, as Nana-HR (she drafts from your instruction; you read, edit and
// send: she never sends on her own) or as you by @username, through the same thread as the team hub (components/ApplicationThread.tsx).
// Notes Jobs conversations belong to each firm and stay on their own job pages.

const when = (iso: string) => (iso ? new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "");

export default function HrInboxPage() {
  const { user, loading } = useAdminAuth();
  const call = useAdminCall(user, "/api/admin/hr-inbox");
  // The whole list comes once and the chips filter it here (the route also takes ?filter=), so switching chips is instant and the
  // open conversation keeps its header whichever chip is on.
  const [rows, setRows] = useState<HrInboxRow[] | null>(null);
  const [unread, setUnread] = useState(0);
  const [filter, setFilter] = useState<HrInboxFilter>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const reload = useCallback(() => {
    call().then((j) => { setRows(j.rows); setUnread(j.unread); }).catch((e) => setError(e instanceof Error ? e.message : "Couldn't load the inbox"));
  }, [call]);
  useEffect(() => { if (user) reload(); }, [user, reload]);
  // A bell for an applicant's reply links here with ?id= (lib/app-replies-server.ts sendReply).
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id");
    if (id) setOpenId(id);
  }, []);

  if (loading || !user) return <div className="px-6 py-24 text-center text-slate">Loading…</div>;
  const shown = rows ? filterRows(rows, filter) : null;
  const open = openId ? rows?.find((r) => r.id === openId) : undefined;
  const count = (f: HrInboxFilter) => (rows ? filterRows(rows, f).length : 0);
  const hubHref = (id: string) => `/admin/team/hr?app=${encodeURIComponent(id)}`;

  return (
    <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
      <Link href="/admin" className="block font-ui text-xs font-semibold uppercase tracking-wideish text-crimson-bright">← Dashboard</Link>
      <p className="eyebrow mt-6">{rows ? (unread ? `${unread} unread` : "All read") : ""}</p>
      <h1 className="mt-3 font-display text-4xl">#Nana-HR inbox</h1>
      <p className="mt-3 max-w-2xl text-sm text-slate">
        What applicants to #NotesApp&apos;s own roles write back to the hiring team. Answer as HR, ask Nana-HR for a draft to read, edit and
        send (she never sends on her own), or answer as yourself. The applicant gets a bell either way. Applications themselves are in{" "}
        <Link href="/admin/team/hr" className="text-crimson underline">Nana-HR &amp; hiring</Link>.
      </p>
      {error && <p className="mt-4 text-sm text-red-700" role="alert">{error}</p>}

      <div className="mt-6 flex flex-wrap gap-2" role="group" aria-label="Show">
        {HR_INBOX_FILTERS.map((f) => (
          <button key={f.key} type="button" onClick={() => setFilter(f.key)} aria-pressed={filter === f.key}
            className={`rounded-full px-3 py-1 font-ui text-xs font-semibold ${filter === f.key ? "bg-crimson text-paper" : "border border-rule text-ink"}`}>
            {f.label}{rows ? ` · ${count(f.key)}` : ""}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <ul className={`card divide-y divide-rule ${openId ? "max-lg:hidden" : ""}`}>
          {shown === null && <li className="p-5 text-sm text-slate">Loading…</li>}
          {shown?.length === 0 && (
            <li className="p-5 text-sm text-slate">
              {filter === "all" ? "Nothing yet. When the team writes to an applicant, or an applicant replies, the conversation shows here." : filter === "unread" ? "Nothing unread." : "Nobody is waiting for an answer."}
            </li>
          )}
          {shown?.map((r) => (
            <li key={r.id}>
              <button type="button" onClick={() => setOpenId(r.id)} className={`flex w-full items-center gap-3 p-4 text-left hover:bg-paper ${openId === r.id ? "bg-paper" : ""}`}>
                <Avatar src={r.applicant.avatar} alt={r.applicant.name} size={40} className="shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className={`truncate font-ui text-sm text-ink ${r.unread ? "font-bold" : "font-semibold"}`}>
                      {r.applicant.name}{r.applicant.username && <span className="ml-1.5 font-normal text-slate">@{r.applicant.username}</span>}
                    </span>
                    <span className="shrink-0 text-[11px] text-slate">{when(r.lastAt)}</span>
                  </span>
                  <span className="block truncate text-xs text-slate">{r.roleTitle} · {r.statusLabel}{r.needsReply ? " · needs reply" : ""}</span>
                  <span className="flex items-center justify-between gap-2">
                    <span className={`truncate text-sm ${r.unread ? "text-ink" : "text-slate"}`}>{r.lastFrom === "applicant" ? "" : `${r.lastLabel}: `}{r.lastText}</span>
                    {r.unread > 0 && <span className="shrink-0 rounded-full bg-crimson px-2 py-0.5 font-ui text-[10px] font-bold text-paper" aria-label={`${r.unread} unread`}>{r.unread}</span>}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>

        <div className={`card flex min-h-[24rem] flex-col ${openId ? "" : "max-lg:hidden"}`}>
          {!openId ? <p className="m-auto p-6 text-sm text-slate">Pick a conversation.</p> : (
            <>
              <div className="flex flex-wrap items-center gap-3 border-b border-rule p-4">
                <button type="button" onClick={() => setOpenId(null)} className="font-ui text-xs font-semibold text-crimson lg:hidden">← Back</button>
                {open && <Avatar src={open.applicant.avatar} alt={open.applicant.name} size={36} className="shrink-0" />}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-ui text-sm font-bold text-ink">
                    {open ? open.applicant.name : "Application"}
                    {open?.applicant.username && <Link href={`/u/${open.applicant.username}`} className="ml-1.5 font-normal text-slate hover:underline">@{open.applicant.username}</Link>}
                  </p>
                  {open && <p className="truncate text-xs text-slate">{open.roleTitle} · {open.statusLabel}</p>}
                </div>
                <Link href={hubHref(openId)} className="shrink-0 rounded-full border border-rule px-3 py-1 font-ui text-xs font-semibold hover:border-crimson">Open application</Link>
              </div>
              <div className="p-4">
                <ApplicationThread key={openId} kind="career" applicationId={openId} startOpen endpoint="/api/admin/hr-inbox" onActivity={reload} />
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
