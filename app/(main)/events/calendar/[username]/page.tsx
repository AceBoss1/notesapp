import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminDb } from "@/lib/firebase-admin";
import { upcoming } from "@/lib/events-server";
import { cleanTheme, coverStyle, whereLine } from "@/lib/event-kit";
import { whenText } from "@/lib/events";
import { formatNaira } from "@/lib/booking-time";
import FollowCalendar from "@/components/events/FollowCalendar";
import type { UserProfile } from "@/lib/users";
import { SITE_URL } from "@/lib/host";

export const dynamic = "force-dynamic";

async function host(username: string) {
  const u = await getAdminDb().collection("users").where("username", "==", username).limit(1).get();
  return u.empty ? null : ({ ...(u.docs[0].data() as UserProfile), uid: u.docs[0].id });
}
export async function generateMetadata({ params }: { params: { username: string } }): Promise<Metadata> {
  const p = await host(params.username);
  return p ? { title: `${p.displayName}'s events`, description: `Upcoming events from ${p.displayName} on #NotesApp. Follow to hear about new ones.` } : { title: "Calendar" };
}

// A host's calendar (docs/EVENTS_DISCOVER.md): their upcoming public events, Follow, and a link calendar apps subscribe to.
export default async function CalendarPage({ params }: { params: { username: string } }) {
  const p = await host(params.username);
  if (!p || p.suspended) notFound();
  const list = await upcoming(getAdminDb(), { host: params.username }, null);
  const theme = cleanTheme({ theme: list[0]?.theme, pattern: list[0]?.pattern }, p.uid);
  const feed = `${SITE_URL.replace(/^https?:/, "webcal:")}/api/events/calendar/${params.username}`;
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="h-28 rounded-2xl" style={coverStyle(theme)} />
      <div className="-mt-10 flex flex-wrap items-end gap-4 px-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={p.avatar || "/images/headshots/default-avatar.png"} alt="" className="h-20 w-20 rounded-2xl border-4 border-paper object-cover" />
        <div className="min-w-0 flex-1 pb-1">
          <h1 className="font-display text-3xl text-ink">{p.displayName}</h1>
          <Link href={`/u/${params.username}`} className="text-sm text-slate">@{params.username}</Link>
        </div>
      </div>
      {p.bio && <p className="mt-4 text-slate">{p.bio}</p>}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <FollowCalendar username={params.username} />
        <a href={feed} className="btn-ghost !px-4 !py-1.5 text-xs">Add to my calendar</a>
      </div>
      <h2 className="mt-8 font-ui text-lg font-bold">Upcoming</h2>
      {!list.length ? <p className="card mt-3 p-6 text-sm text-slate">Nothing coming up right now. Follow to hear when there is.</p> : (
        <ul className="mt-3 grid gap-3">
          {list.map((e) => {
            const s = new Date(e.nextStartAt ?? e.startsAt), len = new Date(e.endsAt).getTime() - new Date(e.startsAt).getTime();
            const t = cleanTheme({ theme: e.theme, pattern: e.pattern }, p.uid);
            return (
              <li key={e.id}><Link href={`/events/${e.id}`} className="card flex items-center gap-4 p-3 hover:border-crimson/50">
                <span className="flex h-16 w-16 shrink-0 items-end overflow-hidden rounded-xl p-1.5 font-display text-[11px] leading-tight" style={e.cover ? { background: `url(${e.cover}) center/cover` } : coverStyle(t)}>{!e.cover && e.title}</span>
                <span className="min-w-0">
                  <span className="block text-xs text-slate">{whenText(s, new Date(s.getTime() + len))}</span>
                  <span className="block font-ui text-sm font-bold text-ink">{e.title}</span>
                  <span className="block text-xs text-slate">{[whereLine({ format: e.format ?? (e.liveUrl && !e.place ? "online" : "in_person"), place: e.place, city: e.city, online: e.online || "" }), e.priceFromKobo ? `From ${formatNaira(e.priceFromKobo)}` : e.approval ? "Free · approval needed" : "Free"].filter(Boolean).join(" · ")}</span>
                </span>
              </Link></li>
            );
          })}
        </ul>
      )}
      <p className="mt-6 text-xs text-slate">Following tells you about each new public event, with a bell and an email. &quot;Add to my calendar&quot; keeps your phone&apos;s calendar up to date with these events.</p>
    </div>
  );
}
