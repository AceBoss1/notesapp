import type { Firestore } from "firebase-admin/firestore";
import { listed } from "./tournament-phase";
import { ARCADE_GAMES } from "./catalogue";
import type { Tournament } from "./tournaments";

// What the tournament page's title and share card, and the sitemap, read from Firestore (owner, 24 Nov 2026: "share cards and sitemap
// entries for each tournament"). Kept apart from lib/arcade/tournaments-server.ts so these server pieces don't load every game's replay
// code or the messaging chain. Only public fields come back: never the seed, the counts or the winners' account ids.

export type ShareTournament = Pick<Tournament, "id" | "game" | "name" | "playFrom" | "playUntil" | "prize" | "prizes" | "ageRule" | "status" | "updatedAt"> & {
  sponsor?: { name: string; logo: string };
  gameName: string;
};

/** Gives up after `ms` (null), so a page's title, its share card or the build's sitemap never hangs on Firestore. */
export function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    p.catch(() => null),
    new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), ms); }),
  ]).finally(() => clearTimeout(timer));
}

const ID = /^[a-z0-9-]{3,64}$/;
const gameNameOf = (slug: string) => ARCADE_GAMES.find((g) => g.slug === slug)?.name ?? slug;

/** One public tournament for its share card and title, or null for a draft, an unlisted one or a bad id (they 404). */
export async function shareTournament(db: Firestore, id: unknown, now = new Date()): Promise<ShareTournament | null> {
  if (typeof id !== "string" || !ID.test(id)) return null;
  const d = (await db.doc(`tournaments/${id}`).get()).data() as Tournament | undefined;
  if (!d || !listed(d, now)) return null;
  return {
    id, game: d.game, name: d.name, playFrom: d.playFrom, playUntil: d.playUntil, prize: d.prize === true, prizes: d.prizes ?? [],
    ageRule: d.ageRule, status: d.status, updatedAt: d.updatedAt, gameName: gameNameOf(d.game),
    ...(d.sponsor ? { sponsor: { name: d.sponsor.name, logo: d.sponsor.logo } } : {}),
  };
}

/** Every public tournament for the sitemap: its id and when it last changed. */
export async function sitemapTournaments(db: Firestore, now = new Date()): Promise<{ id: string; updatedAt?: string }[]> {
  const s = await db.collection("tournaments").where("status", "in", ["open", "closed", "results"]).select("status", "entryFrom", "updatedAt").get();
  return s.docs.filter((d) => listed(d.data() as Tournament, now)).map((d) => ({ id: d.id, updatedAt: d.data().updatedAt as string | undefined }));
}
