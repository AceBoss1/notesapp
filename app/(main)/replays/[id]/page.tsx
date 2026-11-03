import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminDb } from "@/lib/firebase-admin";
import type { ReplayDoc } from "@/lib/live-recording";
import ReplayPlayer from "@/components/replays/ReplayPlayer";
import { ShareButton } from "@/components/share/ShareToNotesApp";
import Avatar from "@/components/Avatar";

// A published replay (lib/live-recording.ts): the player, who hosted it, Share, and Book a session with the host. A replay kept inside
// its community is only shown to its members (the player asks the server), and isn't indexed.
export const dynamic = "force-dynamic";
type Props = { params: { id: string } };
async function load(id: string) {
  if (!/^[A-Za-z0-9_-]{6,80}$/.test(id)) return null;
  return ((await getAdminDb().doc(`replays/${id}`).get()).data() as ReplayDoc | undefined) ?? null;
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const r = await load(params.id);
  if (!r) return { title: "Replay" };
  return { title: `${r.title} (replay)`, description: `A replay of a live with ${r.hostName}${r.communityName ? ` in ${r.communityName}` : ""} on #NotesApp.`, ...(r.listed ? {} : { robots: { index: false } }) };
}
export default async function ReplayPage({ params }: Props) {
  const { id } = params;
  const r = await load(id);
  if (!r) notFound();
  return (
    <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <p className="font-mono text-[11px] uppercase tracking-eyebrow text-crimson">Replay{r.kind === "audio" ? " · audio" : ""}{r.audience === "subscribers" ? " · subscribers" : r.audience === "community" ? " · members only" : ""}</p>
      <h1 className="mt-2 font-display text-3xl leading-tight text-ink sm:text-4xl">{r.title}</h1>
      <div className="mt-4 flex items-center gap-3">
        <Avatar src={r.hostAvatar ?? ""} alt={r.hostName} size={40} />
        <p className="text-sm text-slate">Hosted by {r.hostUsername ? <Link href={`/u/${r.hostUsername}`} className="font-semibold text-ink hover:text-crimson">{r.hostName}</Link> : r.hostName}{r.communityName ? ` in ${r.communityName}` : ""} · {new Date(r.createdAt).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" })}</p>
      </div>
      <ReplayPlayer id={id} />
      <div className="flex flex-wrap items-center gap-3">
        {r.audience !== "community" && <ShareButton shareRef={{ kind: "replay", id }} path={`/replays/${id}`} title={r.title} className="rounded-full border border-rule px-4 py-2 font-ui text-sm font-semibold text-ink hover:border-crimson" />}
        {r.hostUsername && <Link href={`/u/${r.hostUsername}#book`} className="btn-primary !px-4 !py-2 text-sm">Book a session with {r.hostName.split(" ")[0]}</Link>}
      </div>
    </article>
  );
}
