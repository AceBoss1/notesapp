// Per-game leaderboards on the server (owner, Nov 2026: "each game has leaderboard makeup of top npc 🤖 and top human, then shares same
// notesville rich list"; docs/ARCADE_TOURNAMENTS.md §4). The rules for reading a record out of a member's saved progress, the caps and
// the computer players are in lib/arcade/boards.ts; this file stores and lists them.
//
//   arcadeBoards/{slug}               { npcWins: { <computer id>: wins vs members }, autopilot?: { <speed>: score }, autopilotVersion? }
//   arcadeBoards/{slug}/people/{uid}  { uid, value, wins?, losses?, day, dayGain, dayNpc, updatedAt }
// Server only (firestore.rules): the pages read them through GET /api/arcade/boards/[slug].
//
// Who appears, following the Notes Life Billionaires List (richList in lib/life/server.ts) and docs/YOUNG_MEMBERS.md:
//   - guests never (they have no saved progress; only /api/arcade/progress writes a row);
//   - child profiles (kids mode, kid_<id>) never: no row is written, and any row is skipped when listing;
//   - teen mode, and members who kept themselves hidden after 18 (users.keepHidden), are kept off the board (keptOffLists in
//     lib/young.ts), except for themselves and people they follow back (lifeRowShown), exactly as on the Billionaires List;
//   - suspended accounts, and accounts with no username yet, are left off;
//   - the name shown is the member's own display name (else username), read when the board is listed, so a change shows at once.
import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { isKidUid } from "../kids";
import { keptOffLists, lifeRowShown } from "../young";
import { cleanKv, mergeKv } from "./progress";
import {
  NPCS_SHOWN, PEOPLE_SHOWN, boardRule, creditSave, lagosDay, touchedBoards, type BoardPersonRow, type BoardView, type PersonRecord,
} from "./boards";
import { autopilotScores } from "./boards-bots";

// Bump when an autopilot or a game's rules change, so the stored 🤖 scores are worked out again.
export const AUTOPILOT_VERSION = 1;

const boardRef = (db: Firestore, slug: string) => db.doc(`arcadeBoards/${slug}`);
const personRef = (db: Firestore, slug: string, uid: string) => db.doc(`arcadeBoards/${slug}/people/${uid}`);

function asRecord(d: FirebaseFirestore.DocumentData | undefined): PersonRecord | null {
  if (!d) return null;
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  return {
    value: n(d.value), day: typeof d.day === "string" ? d.day : "", dayGain: n(d.dayGain), dayNpc: n(d.dayNpc),
    ...(d.wins !== undefined ? { wins: n(d.wins) } : {}), ...(d.losses !== undefined ? { losses: n(d.losses) } : {}),
  };
}

/**
 * Saves a member's Arcade progress (POST /api/arcade/progress) and, in the same transaction, moves the leaderboards of the games the
 * save touched: the member's row and the computer players' wins. Returns the merged kv, as the route always did.
 */
export async function saveProgress(db: Firestore, uid: string, update: Record<string, string>, now = new Date()): Promise<Record<string, string>> {
  const ref = db.doc(`arcadeProgress/${uid}`);
  const rules = isKidUid(uid) ? [] : touchedBoards(update); // a child profile never has a row
  const today = lagosDay(now);
  return db.runTransaction(async (tx) => {
    const [snap, user, ...rows] = await Promise.all([
      tx.get(ref),
      rules.length ? tx.get(db.doc(`users/${uid}`)) : Promise.resolve(null),
      ...rules.map((r) => tx.get(personRef(db, r.slug, uid))),
    ]);
    const before = cleanKv(snap.get("kv"));
    const merged = mergeKv(before, update).kv;
    tx.set(ref, { kv: merged, updatedAt: FieldValue.serverTimestamp() }, { merge: false });
    const u = user?.data();
    // No profile, a child profile or a suspended account: progress is saved, the boards are left alone.
    if (!u || u.kid === true || u.suspended === true || !u.username) return merged;
    rules.forEach((rule, i) => {
      const { record, npc } = creditSave(rule, asRecord(rows[i]!.data()), before, merged, today);
      if (record) tx.set(personRef(db, rule.slug, uid), { uid, ...record, updatedAt: now.toISOString() });
      if (Object.keys(npc).length) {
        tx.set(boardRef(db, rule.slug), { npcWins: Object.fromEntries(Object.entries(npc).map(([id, n]) => [id, FieldValue.increment(n)])), updatedAt: now.toISOString() }, { merge: true });
      }
    });
    return merged;
  });
}

/** The action games' 🤖 scores: worked out once (lib/arcade/boards-bots.ts) and kept on the board doc until the version changes. */
async function autopilot(db: Firestore, slug: string, doc: FirebaseFirestore.DocumentData | undefined): Promise<Record<string, number>> {
  if (doc?.autopilotVersion === AUTOPILOT_VERSION && doc.autopilot && typeof doc.autopilot === "object") return doc.autopilot as Record<string, number>;
  const scores = autopilotScores(slug);
  await boardRef(db, slug).set({ autopilot: scores, autopilotVersion: AUTOPILOT_VERSION }, { merge: true }).catch(() => undefined);
  return scores;
}

export class BoardError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

/**
 * One game's leaderboard: the computer players 🤖 (top NPCS_SHOWN) and the people (top PEOPLE_SHOWN), and, for a signed-in viewer, their
 * own place. Without a viewer, members kept off lists are never shown (that answer may be cached for everyone).
 */
export async function getBoard(db: Firestore, slug: string, viewer?: string | null): Promise<BoardView> {
  const rule = boardRule(slug);
  if (!rule) throw new BoardError(404, "That game has no leaderboard.");
  const board = (await boardRef(db, slug).get()).data();
  const npcScores = rule.metric === "best" ? await autopilot(db, slug, board) : ((board?.npcWins ?? {}) as Record<string, number>);
  const npcs = rule.npcs.map((n) => ({ id: n.id, name: n.name, value: Math.max(0, Math.floor(Number(npcScores[n.id]) || 0)) }))
    .sort((a, b) => b.value - a.value).slice(0, NPCS_SHOWN);

  const col = db.collection(`arcadeBoards/${slug}/people`);
  // A few extra rows so the ones left off (kids, hidden, suspended) don't leave the board short.
  const top = (await col.where("value", ">", 0).orderBy("value", "desc").limit(PEOPLE_SHOWN + 20).get()).docs.filter((d) => !isKidUid(d.id));
  const users = top.length ? await db.getAll(...top.map((d) => db.doc(`users/${d.id}`))) : [];
  const viewerDoc = viewer ? (await db.doc(`users/${viewer}`).get()).data() : undefined;
  const myName = String(viewerDoc?.username ?? "");
  const shown = await Promise.all(top.map(async (d, i) => {
    const u = users[i].data();
    if (!u || u.kid === true || u.suspended === true || !u.username) return false;
    if (!keptOffLists(u) || d.id === viewer) return true;
    if (!viewer || !myName) return false;
    const [a, b] = await db.getAll(db.doc(`follows/${viewer}_${u.username}`), db.doc(`follows/${d.id}_${myName}`));
    return lifeRowShown({ user: u, self: false, viewerFollows: a.exists, followsViewer: b.exists });
  }));
  // Ties: whoever got there first stays above.
  const kept = top.map((d, i) => ({ d, u: users[i]?.data(), ok: shown[i] })).filter((x) => x.ok)
    .sort((a, b) => Number(b.d.get("value")) - Number(a.d.get("value")) || String(a.d.get("updatedAt")).localeCompare(String(b.d.get("updatedAt"))))
    .slice(0, PEOPLE_SHOWN);
  const people: BoardPersonRow[] = kept.map(({ d, u }, i) => {
    const x = d.data();
    return {
      rank: i + 1, name: String(u?.displayName || u?.username || ""), username: String(u?.username ?? ""), value: Number(x.value) || 0,
      ...(rule.metric === "wins" ? { wins: Number(x.wins ?? x.value) || 0, losses: Number(x.losses) || 0 } : {}),
      ...(d.id === viewer ? { you: true } : {}),
    };
  });

  const view: BoardView = { game: slug, metric: rule.metric, label: rule.label, npcLabel: rule.metric === "best" ? "Autopilot best score" : "Wins vs members", npcs, people };
  if (viewer) {
    const mine = isKidUid(viewer) ? undefined : (await col.doc(viewer).get()).data();
    const value = Number(mine?.value) || 0;
    // Rank among everyone with a better record, as the Billionaires List counts it (people kept off the board still count).
    const above = value > 0 ? (await col.where("value", ">", value).count().get()).data().count : 0;
    view.me = { rank: value > 0 ? above + 1 : null, value, ...(keptOffLists(viewerDoc) ? { hidden: true } : {}) };
  }
  return view;
}
