"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Avatar from "@/components/Avatar";
import { ApplicationThread } from "@/components/ApplicationThread";
import { HR_INBOX_FILTERS, filterRows, type HrInboxFilter, type HrInboxRow } from "@/lib/hr-inbox";
import type { AppKind } from "@/lib/app-replies";

// A #Nana-HR inbox: the list of application threads, newest activity first, beside the open one (stacked on phones), with the filters
// All / Unread / Needs reply. Two pages use it (lib/hr-inbox-server.ts): Admin → #Nana-HR inbox for #NotesApp's own roles, and each
// firm's inbox for its Notes Jobs (owner, 26 Nov 2026: "applications to other firms' jobs stay with those firms"). The page loads the
// list (load) and says where the full application is (fullHref); answers go through components/ApplicationThread.tsx against the
// page's route (endpoint, with the firm in scope), so Nana-HR only drafts and a person sends.

const when = (iso: string) => (iso ? new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "");

export function HrInbox({ kind, load, endpoint, scope, fullHref, ready = true }: {
  kind: AppKind; load: () => Promise<{ rows: HrInboxRow[]; unread: number }>; endpoint: string; scope?: { org: string };
  fullHref: (id: string) => string; ready?: boolean;
}) {
  // The whole list comes once and the chips filter it here (the routes also take ?filter=), so switching chips is instant and the
  // open conversation keeps its header whichever chip is on.
  const [rows, setRows] = useState<HrInboxRow[] | null>(null);
  const [unread, setUnread] = useState(0);
  const [filter, setFilter] = useState<HrInboxFilter>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const reload = useCallback(() => {
    load().then((j) => { setRows(j.rows); setUnread(j.unread); setError(""); }).catch((e) => setError(e instanceof Error ? e.message : "Couldn't load the inbox"));
  }, [load]);
  useEffect(() => { if (ready) { setRows(null); reload(); } }, [ready, reload]);
  // A bell for an applicant's reply links here with ?id= (lib/app-replies-server.ts sendReply).
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id");
    if (id) setOpenId(id);
  }, []);

  const shown = rows ? filterRows(rows, filter) : null;
  const open = openId ? rows?.find((r) => r.id === openId) : undefined;
  const count = (f: HrInboxFilter) => (rows ? filterRows(rows, f).length : 0);

  return (
    <>
      <p className="eyebrow mt-6">{rows ? (unread ? `${unread} unread` : "All read") : ""}</p>
      {error && <p className="mt-4 text-sm text-red-700" role="alert">{error}</p>}

      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Show">
        {HR_INBOX_FILTERS.map((f) => (
          <button key={f.key} type="button" onClick={() => setFilter(f.key)} aria-pressed={filter === f.key}
            className={`rounded-full px-3 py-1 font-ui text-xs font-semibold ${filter === f.key ? "bg-crimson text-paper" : "border border-rule text-ink"}`}>
            {f.label}{rows ? ` · ${count(f.key)}` : ""}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <ul className={`card divide-y divide-rule ${openId ? "max-lg:hidden" : ""}`}>
          {shown === null && <li className="p-5 text-sm text-slate">{error ? "" : "Loading…"}</li>}
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
                <Link href={fullHref(openId)} className="shrink-0 rounded-full border border-rule px-3 py-1 font-ui text-xs font-semibold hover:border-crimson">Open application</Link>
              </div>
              <div className="p-4">
                <ApplicationThread key={`${scope?.org ?? ""}:${openId}`} kind={kind} applicationId={openId} startOpen endpoint={endpoint} scope={scope} onActivity={reload} />
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
