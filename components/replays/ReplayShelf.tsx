"use client";

import { useEffect, useState } from "react";
import RankedList from "@/components/RankedList";
import type { ReplayCard } from "@/lib/live-recording-server";

// Replays of lives on Explore (newest) and Trending (most watched in the period): the listed ones only, those for everyone or the host's
// subscribers (lib/live-recording.ts). Hosts in teen mode and replays kept inside a community never show here.
const mins = (s?: number) => (s ? `${Math.max(1, Math.round(s / 60))} min` : "");
export default function ReplayShelf({ sort, days = 7, q = "" }: { sort: "new" | "trending"; days?: number; q?: string }) {
  const [rows, setRows] = useState<ReplayCard[] | null>(null);
  useEffect(() => {
    setRows(null);
    fetch(`/api/replays?list=${sort}&days=${days}`).then((r) => (r.ok ? r.json() : Promise.reject())).then((d) => setRows(d.replays ?? [])).catch(() => setRows([]));
  }, [sort, days]);
  if (rows === null) return <p className="py-6 text-sm text-slate">Loading…</p>;
  const term = q.trim().toLowerCase();
  const list = term ? rows.filter((r) => `${r.title} ${r.hostName} ${r.communityName}`.toLowerCase().includes(term)) : rows;
  if (!list.length) return <p className="py-6 text-sm text-slate">{term ? "No replays match that search." : sort === "trending" ? "No replays watched in this period yet." : "No replays yet. Hosts publish them from recorded lives."}</p>;
  return <RankedList rows={list.map((r) => ({ key: r.id, href: `/replays/${r.id}`, title: r.title, image: r.hostAvatar || undefined, count: r.views, sub: <>{r.hostName}{r.communityName ? ` · ${r.communityName}` : ""}{r.kind === "audio" ? " · audio" : ""}{r.duration ? ` · ${mins(r.duration)}` : ""}{r.audience === "subscribers" ? " · subscribers" : ""}</> }))} />;
}
