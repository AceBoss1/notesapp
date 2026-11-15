"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/moments-client";
import { familyHost } from "@/lib/host";
import { inviteLink, type InviteStats } from "@/lib/growth";
import { CopyLink } from "./ReferralsPanel";

// Your invite link (docs/GROWTH.md): the member's install link, app.<domain>/install?by=<username>, and their own numbers: how many
// opened it this month, joined through them (the link, their /r/ link or their code), installed the app and are still active.
// Counts only: never who.
export default function InviteLinkCard({ username }: { username: string }) {
  const [stats, setStats] = useState<InviteStats | null>(null);
  const [origin, setOrigin] = useState("");
  useEffect(() => {
    const { protocol, hostname, port } = window.location;
    const app = familyHost(hostname, "app");
    setOrigin(app === hostname ? `${protocol}//${hostname}${port ? `:${port}` : ""}` : `https://${app}`);
    api<InviteStats>("/api/growth").then(setStats).catch(() => setStats({ opened: 0, joined: 0, installed: 0, active: 0 }));
  }, []);
  if (!username) return null;
  const link = origin ? inviteLink(origin, username) : "";
  const tiles: [number | undefined, string][] = [
    [stats?.opened, "opened your link this month"],
    [stats?.joined, "joined"],
    [stats?.installed, "installed the app"],
    [stats?.active, "still active"],
  ];
  return (
    <div className="card p-5">
      <h2 className="font-display text-2xl text-ink">Your invite link</h2>
      <div className="mt-3 rounded-xl border border-rule bg-field p-3">
        <p className="break-all font-ui text-sm font-bold text-ink">{link.replace(/^https?:\/\//, "") || "…"}</p>
        <p className="mt-1 text-xs text-slate">Share it anywhere. People who install and join through it are counted as yours.</p>
      </div>
      {link && <div className="mt-3"><CopyLink url={link} label="Copy invite link" /></div>}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map(([v, label]) => (
          <div key={label} className="rounded-xl border border-rule bg-card p-3">
            <p className="font-display text-2xl text-ink">{v === undefined ? "…" : v.toLocaleString("en-NG")}</p>
            <p className="mt-0.5 text-xs text-slate">{label}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-slate">
        It works like your referral link: friends who join through it count towards your rewards and milestones. Still active means seen in the last two weeks.
        We show numbers only, never who. <Link href="/help/invite-link" className="text-crimson underline">How it&apos;s counted</Link>
      </p>
    </div>
  );
}
