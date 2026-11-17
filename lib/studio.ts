// Notes Live Studio (v0.177.0, docs/NOTES_LIVE_STUDIO.md): broadcast graphics over a live room. Pure and client-safe; the server side is
// studioStep in lib/rooms-server.ts.
//
// How it reaches viewers. The studio does not mix a new video on a server. The room carries the sound and the cameras as before
// (lib/rooms.ts), and the room's document holds one small `studio` object: the layout, the logo, the lower third, the ticker, the
// subtitle line, the viewer's comment on air, the clip playing and the sponsor spot. Every screen in the room draws the same programme
// from it (components/studio/ProgramFrame.tsx), so the words stay sharp on any connection and cost nothing to send. A change is one
// write to the room; nothing here changes more than a few times a minute.
//
// Who does what (owner, 15 Nov 2026: "host/editor/guest/moderator/viewer privileges"):
// - Host: everything, and the only one who switches the studio on or off.
// - Editor: a moderator holding "studio" (lib/rooms.ts MOD_PERMS): the layout, logo, lower third, ticker, subtitles, clips, sponsor spot.
// - Moderator: holding "onair": puts a viewer's comment on air and keeps the on-air queue (beside the chat powers they already had).
// - Guest: someone on stage. Can share their screen when the host lets speakers use video.
// - Viewer: watches, and comments in the room's chat.
//
// While the team tests it, the studio opens only in a live started on the staff test pass (lib/staff-pass.ts), like Go live itself.
// Opening it to everyone is this one switch.
export const STUDIO_FOR_EVERYONE = false;
export const studioAllowed = (r: { staffPass?: boolean }) => STUDIO_FOR_EVERYONE || r.staffPass === true;
export const STUDIO_CLOSED = "Notes Live Studio is being tested by the #NotesApp team. It opens to everyone soon.";

export const STUDIO_LAYOUTS = [
  { id: "auto", label: "Auto", hint: "Everyone on stage, side by side" },
  { id: "solo", label: "Solo", hint: "One person fills the screen" },
  { id: "spotlight", label: "Spotlight", hint: "One person large, the others beside them" },
  { id: "grid", label: "Grid", hint: "Equal tiles in rows" },
  { id: "pip", label: "Picture in picture", hint: "One person full screen, the others small in the corner" },
] as const;
export type StudioLayout = (typeof STUDIO_LAYOUTS)[number]["id"];
export const STUDIO_THEMES = [
  { id: "crimson", label: "Crimson newsroom" },
  { id: "midnight", label: "Midnight" },
  { id: "ivory", label: "Ivory" },
] as const;
export type StudioTheme = (typeof STUDIO_THEMES)[number]["id"];
export const LOWER_STYLES = [{ id: "headline", label: "Headline + name" }, { id: "name", label: "Name only" }, { id: "breaking", label: "Breaking" }] as const;
export type LowerStyle = (typeof LOWER_STYLES)[number]["id"];
export const TICKER_SPEEDS = ["slow", "normal", "fast"] as const;
export type TickerSpeed = (typeof TICKER_SPEEDS)[number];
// Seconds for the whole ticker to cross once, per 100 characters.
export const TICKER_SECONDS: Record<TickerSpeed, number> = { slow: 26, normal: 18, fast: 12 };
export const SPONSOR_SLOTS = [{ id: "corner", label: "Corner card" }, { id: "banner", label: "Banner above the ticker" }] as const;
export type SponsorSlot = (typeof SPONSOR_SLOTS)[number]["id"];

export const STUDIO_MAX = { kicker: 40, head: 110, name: 60, role: 90, show: 40, place: 60, tag: 20, line: 160, lines: 8, caption: 180, comment: 280, queue: 10, label: 60, url: 600 } as const;

// The logo and the LIVE badge at the top of the picture. logo "": the NotesApp mark.
export type StudioBug = { on: boolean; logo: string; show: string; place: string; live: boolean; clock: boolean };
export type StudioLower = { on: boolean; style: LowerStyle; kicker: string; head: string; name: string; role: string };
export type StudioTicker = { on: boolean; tag: string; lines: string[]; speed: TickerSpeed };
// A viewer's comment on air (or waiting in the queue). by: the moderator who chose it.
export type StudioComment = { id: string; from: string; name: string; avatar: string; text: string; by: string };
// A clip playing for everyone: an intro, an outro, a video or a sound in between, or a picture (a slide, a title card). `at` is when
// it started, so someone who joins half way sees it from the right place. ad: a full-screen sponsor's video, marked as an advertisement.
export type StudioClipKind = "video" | "audio" | "image";
export type StudioClip = { url: string; kind: StudioClipKind; label: string; at: string; ad: boolean; by: string };
// The sponsor spot: a picture (it may move) or a video with no sound, in one of the two marked places.
export type StudioSponsor = { url: string; kind: "image" | "video"; slot: SponsorSlot; label: string };
// Automatic subtitles (docs/STUDIO_SUBTITLES.md): each person on stage has their own device write down their own microphone, and
// posts the line with their name. look: one of Moments' three. off: speakers who are not subtitled (their own choice, or the
// editor's). quiet: speakers who have muted themselves, so a lone voice is shown without a name.
export const SUB_LOOKS = ["clean", "bold", "colour"] as const;
export type SubLook = (typeof SUB_LOOKS)[number];
export const SUB_LOOK_LABEL: Record<SubLook, string> = { clean: "Clean", bold: "Bold word", colour: "Colour word" };
export const SUB_LANGS = ["en", "pcm"] as const;
export type SubLang = (typeof SUB_LANGS)[number];
export type StudioSubs = { on: boolean; look: SubLook; names: boolean; lang: SubLang; off: string[]; quiet: string[] };
// A line that was said. ms: how long it took to say, so the highlight can move through it. solo: nobody else's microphone was on,
// so the name is left off.
export type SubLine = { uid: string; name: string; text: string; at: string; ms: number; solo: boolean };
export const SUBS = { line: 140, lines: 2, gapMs: 2000, holdMs: 4500, pieceSec: 4, maxPieceSec: 6, perLiveSec: 3 * 3600 } as const;

export type StudioState = {
  on: boolean; layout: StudioLayout; theme: StudioTheme;
  focus: string; // who is large in Solo, Spotlight and Picture in picture ("" = the host)
  bug: StudioBug; lower: StudioLower; ticker: StudioTicker;
  caption: string; // the subtitle line under the picture ("" = none)
  comment: StudioComment | null; queue: StudioComment[];
  clip: StudioClip | null; sponsor: StudioSponsor | null;
  screen: string; // who is sharing their screen ("" = nobody): their tile is shown whole, never cropped
  subs: StudioSubs; said: SubLine[]; // automatic subtitles, and the lines on screen (two at most)
  at: string;
};

export const DEFAULT_STUDIO: StudioState = {
  on: false, layout: "auto", theme: "crimson", focus: "",
  bug: { on: true, logo: "", show: "NOTES LIVE", place: "", live: true, clock: true },
  lower: { on: false, style: "headline", kicker: "", head: "", name: "", role: "" },
  ticker: { on: false, tag: "NOTES LIVE", lines: [], speed: "normal" },
  caption: "", comment: null, queue: [], clip: null, sponsor: null, screen: "",
  subs: { on: false, look: "clean", names: true, lang: "en", off: [], quiet: [] }, said: [], at: "",
};
// The room's studio with every field present (a room from before, or a half-written one, reads as the defaults).
export function studioOf(r: { studio?: Partial<StudioState> | null } | null | undefined): StudioState {
  const s = r?.studio ?? {};
  return {
    ...DEFAULT_STUDIO, ...s,
    bug: { ...DEFAULT_STUDIO.bug, ...(s.bug ?? {}) }, lower: { ...DEFAULT_STUDIO.lower, ...(s.lower ?? {}) },
    ticker: { ...DEFAULT_STUDIO.ticker, ...(s.ticker ?? {}), lines: Array.isArray(s.ticker?.lines) ? s.ticker!.lines : [] },
    queue: Array.isArray(s.queue) ? s.queue : [], comment: s.comment ?? null, clip: s.clip ?? null, sponsor: s.sponsor ?? null,
    subs: { ...DEFAULT_STUDIO.subs, ...(s.subs ?? {}), off: Array.isArray(s.subs?.off) ? s.subs!.off : [], quiet: Array.isArray(s.subs?.quiet) ? s.subs!.quiet : [] },
    said: Array.isArray(s.said) ? s.said : [],
  };
}
export const studioOn = (r: { studio?: Partial<StudioState> | null } | null | undefined) => r?.studio?.on === true;

// One line of text someone typed: no line breaks or control characters, trimmed, cut to length.
export const cleanLine = (v: unknown, max: number): string =>
  // eslint-disable-next-line no-control-regex
  String(typeof v === "string" || typeof v === "number" ? v : "").replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
const pick = <T extends string>(v: unknown, list: readonly T[], fallback: T): T => (list.includes(v as T) ? (v as T) : fallback);
const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

// A picture, video or sound the studio may show: only a file in our own storage, uploaded from the studio by the person setting it
// (their own posters/ or studio/ folder). `base` is the storage's public address; "" always passes (it clears the field).
export const STUDIO_FOLDER = "studio";
export function ownStudioFile(url: unknown, base: string, uid: string, folders: readonly string[]): string | null {
  const u = String(url ?? "");
  if (!u) return "";
  if (!base || u.length > STUDIO_MAX.url || /[\s"'<>\\]/.test(u) || u.includes("..")) return null;
  const root = base.replace(/\/$/, "");
  return folders.some((f) => u.startsWith(`${root}/${f}/${uid}/`)) ? u : null;
}
// Clips the studio uploads itself (app/api/studio/upload): a video or a sound. Pictures go up as posters do (lib/upload.ts).
export const STUDIO_CLIP_TYPES: Record<string, { kind: "video" | "audio"; ext: string }> = {
  "video/mp4": { kind: "video", ext: "mp4" }, "video/webm": { kind: "video", ext: "webm" },
  "audio/mpeg": { kind: "audio", ext: "mp3" }, "audio/mp4": { kind: "audio", ext: "m4a" }, "audio/x-m4a": { kind: "audio", ext: "m4a" },
  "audio/wav": { kind: "audio", ext: "wav" }, "audio/ogg": { kind: "audio", ext: "ogg" }, "audio/webm": { kind: "audio", ext: "weba" },
};
export const STUDIO_CLIP_MAX: Record<"video" | "audio", number> = { video: 100 * 1024 * 1024, audio: 20 * 1024 * 1024 };
export const clipKindOf = (url: string): StudioClipKind => (/\.(mp4|webm|mov)(\?|$)/i.test(url) ? "video" : /\.(mp3|m4a|wav|ogg|weba)(\?|$)/i.test(url) ? "audio" : "image");

// What an editor sent for the graphics, laid over the studio as it stands. Only the fields named here change; anything unknown is
// dropped. `file`: checks an address (ownStudioFile, bound to the storage and the editor by the server).
export type StudioPatch = Partial<Pick<StudioState, "layout" | "theme" | "focus" | "caption">> & { subs?: Partial<Pick<StudioSubs, "on" | "look" | "names" | "lang">>; bug?: Partial<StudioBug>; lower?: Partial<StudioLower>; ticker?: Partial<StudioTicker>; sponsor?: Partial<StudioSponsor> | null };
export function applyStudioPatch(cur: StudioState, input: unknown, opts: { file: (url: unknown) => string | null; stage: readonly string[] }): { ok: true; studio: StudioState } | { ok: false; error: string } {
  const p = obj(input);
  const next: StudioState = { ...cur, bug: { ...cur.bug }, lower: { ...cur.lower }, ticker: { ...cur.ticker, lines: [...cur.ticker.lines] } };
  if ("layout" in p) next.layout = pick(p.layout, STUDIO_LAYOUTS.map((l) => l.id), cur.layout);
  if ("theme" in p) next.theme = pick(p.theme, STUDIO_THEMES.map((t) => t.id), cur.theme);
  if ("focus" in p) { const f = String(p.focus ?? ""); next.focus = f && opts.stage.includes(f) ? f : ""; }
  if ("caption" in p) next.caption = cleanLine(p.caption, STUDIO_MAX.caption);
  if ("subs" in p) {
    const b = obj(p.subs);
    next.subs = { ...cur.subs, on: bool(b.on, cur.subs.on), look: pick(b.look, SUB_LOOKS, cur.subs.look), names: bool(b.names, cur.subs.names), lang: pick(b.lang, SUB_LANGS, cur.subs.lang) };
    if (!next.subs.on) next.said = []; // switched off: the lines go at once
  }
  if ("bug" in p) {
    const b = obj(p.bug);
    if ("logo" in b) { const logo = opts.file(b.logo); if (logo === null) return { ok: false, error: "Upload the logo from the studio first." }; next.bug.logo = logo; }
    if ("on" in b) next.bug.on = bool(b.on, cur.bug.on);
    if ("live" in b) next.bug.live = bool(b.live, cur.bug.live);
    if ("clock" in b) next.bug.clock = bool(b.clock, cur.bug.clock);
    if ("show" in b) next.bug.show = cleanLine(b.show, STUDIO_MAX.show);
    if ("place" in b) next.bug.place = cleanLine(b.place, STUDIO_MAX.place);
  }
  if ("lower" in p) {
    const l = obj(p.lower);
    if ("on" in l) next.lower.on = bool(l.on, cur.lower.on);
    if ("style" in l) next.lower.style = pick(l.style, LOWER_STYLES.map((s) => s.id), cur.lower.style);
    if ("kicker" in l) next.lower.kicker = cleanLine(l.kicker, STUDIO_MAX.kicker);
    if ("head" in l) next.lower.head = cleanLine(l.head, STUDIO_MAX.head);
    if ("name" in l) next.lower.name = cleanLine(l.name, STUDIO_MAX.name);
    if ("role" in l) next.lower.role = cleanLine(l.role, STUDIO_MAX.role);
    if (next.lower.on && !next.lower.head && !next.lower.name) return { ok: false, error: "Write a headline or a name for the lower third first." };
  }
  if ("ticker" in p) {
    const t = obj(p.ticker);
    if ("on" in t) next.ticker.on = bool(t.on, cur.ticker.on);
    if ("speed" in t) next.ticker.speed = pick(t.speed, TICKER_SPEEDS, cur.ticker.speed);
    if ("tag" in t) next.ticker.tag = cleanLine(t.tag, STUDIO_MAX.tag);
    if ("lines" in t) next.ticker.lines = (Array.isArray(t.lines) ? t.lines : []).map((x) => cleanLine(x, STUDIO_MAX.line)).filter(Boolean).slice(0, STUDIO_MAX.lines);
    if (next.ticker.on && !next.ticker.lines.length) return { ok: false, error: "Add a line to the ticker first." };
  }
  if ("sponsor" in p) {
    if (!p.sponsor) next.sponsor = null;
    else {
      const s = obj(p.sponsor);
      const url = opts.file(s.url);
      if (!url) return { ok: false, error: "Upload the sponsor's picture or video from the studio first." };
      next.sponsor = { url, kind: clipKindOf(url) === "video" ? "video" : "image", slot: pick(s.slot, SPONSOR_SLOTS.map((x) => x.id), "corner"), label: cleanLine(s.label, STUDIO_MAX.label) };
    }
  }
  return { ok: true, studio: next };
}

// A comment for the air or the queue, from what the moderator's screen sent (the server prefers the chat's own copy when it has one).
export function cleanComment(input: unknown, by: string): StudioComment | null {
  const c = obj(input);
  const id = cleanLine(c.id, 80), text = cleanLine(c.text, STUDIO_MAX.comment), from = cleanLine(c.from, 128);
  if (!id || !text || !from) return null;
  const avatar = String(c.avatar ?? "");
  return { id, from, name: cleanLine(c.name, STUDIO_MAX.name) || "A viewer", avatar: /^https:\/\/[^\s"'<>]{1,500}$/.test(avatar) ? avatar : "", text, by };
}
export function queueWith(queue: readonly StudioComment[], c: StudioComment): StudioComment[] {
  return [...queue.filter((q) => q.id !== c.id), c].slice(-STUDIO_MAX.queue);
}

// Who is in the picture, in order: for Solo only the person in focus; otherwise the person in focus first, then the rest of the stage.
// Someone sharing their screen is always the one in focus.
export function programTiles(s: Pick<StudioState, "layout" | "focus" | "screen">, stage: readonly string[], hostUid: string): string[] {
  if (!stage.length) return [];
  const lead = [s.screen, s.focus, hostUid].find((u) => !!u && stage.includes(u)) ?? stage[0];
  if (s.layout === "solo") return [lead];
  if (s.layout === "auto" && !s.screen && !s.focus) return [...stage];
  return [lead, ...stage.filter((u) => u !== lead)];
}
// The layout drawn for a number of tiles: Auto turns into the plainest one that fits, and one person alone is always Solo.
export function layoutFor(layout: StudioLayout, tiles: number, screen: boolean): Exclude<StudioLayout, "auto"> | "row" {
  if (tiles <= 1) return "solo";
  if (layout === "auto") return screen ? "spotlight" : tiles <= 3 ? "row" : "grid";
  return layout;
}
// Where a clip should be playing now, in seconds, for someone who joins late.
export const clipOffset = (clip: Pick<StudioClip, "at">, now = Date.now()) => Math.max(0, (now - Date.parse(clip.at)) / 1000);

// ── Automatic subtitles ──────────────────────────────────────────────────────────────────────────────────────────────────────────
const without = (list: readonly string[], uid: string) => list.filter((u) => u !== uid);
const withUid = (list: readonly string[], uid: string, on: boolean) => (on ? [...without(list, uid), uid].slice(-60) : without(list, uid));
// Nobody else's microphone is on: the others on stage are muted by the host, have muted themselves, or there is nobody else. Then
// the line is shown without a name (owner, 17 Nov 2026: "in solo broadcast mode name is omitted").
export function voiceAlone(stage: readonly string[], hostMuted: Readonly<Record<string, unknown>> | undefined, quiet: readonly string[], uid: string): boolean {
  return !stage.some((u) => u !== uid && !hostMuted?.[u] && !quiet.includes(u));
}
// May this person's words go on screen? On stage, subtitles on, not switched off for them, microphone not turned off by the host.
export function maySay(s: StudioState, stage: readonly string[], hostMuted: Readonly<Record<string, unknown>> | undefined, uid: string): string | null {
  if (!s.on || !s.subs.on) return "Subtitles are switched off.";
  if (!stage.includes(uid)) return "Only people on stage are subtitled.";
  if (s.subs.off.includes(uid)) return "Your subtitles are switched off.";
  if (hostMuted?.[uid]) return "Your microphone is off.";
  return null;
}
// A line someone said, added to what is on screen: their newest line replaces their last, and at most two people's lines show.
export function sayLine(s: StudioState, line: { uid: string; name: unknown; text: unknown; ms: unknown }, o: { stage: readonly string[]; hostMuted?: Readonly<Record<string, unknown>>; now: Date }): { ok: true; studio: StudioState } | { ok: false; status: number; error: string } {
  const no = maySay(s, o.stage, o.hostMuted, line.uid);
  if (no) return { ok: false, status: 403, error: no };
  const text = cleanLine(line.text, SUBS.line);
  if (!text) return { ok: false, status: 400, error: "Nothing was said." };
  const last = s.said.find((l) => l.uid === line.uid);
  if (last && o.now.getTime() - Date.parse(last.at) < SUBS.gapMs) return { ok: false, status: 429, error: "That line came too soon after the last one." };
  const ms = Math.max(800, Math.min(SUBS.maxPieceSec * 1000, Math.round(Number(line.ms)) || SUBS.pieceSec * 1000));
  const fresh = s.said.filter((l) => l.uid !== line.uid && o.now.getTime() - Date.parse(l.at) < l.ms + SUBS.holdMs);
  const mine: SubLine = { uid: line.uid, name: cleanLine(line.name, STUDIO_MAX.name) || "Speaker", text, at: o.now.toISOString(), ms, solo: voiceAlone(o.stage, o.hostMuted, s.subs.quiet, line.uid) };
  return { ok: true, studio: { ...s, said: [...fresh, mine].slice(-SUBS.lines) } };
}
// A speaker's own subtitles off or on (their choice, or the editor's), and whether they have muted themselves.
export const subsFor = (s: StudioState, uid: string, off: boolean): StudioState => ({ ...s, subs: { ...s.subs, off: withUid(s.subs.off, uid, off) }, said: off ? s.said.filter((l) => l.uid !== uid) : s.said });
export const subsQuiet = (s: StudioState, uid: string, quiet: boolean): StudioState => ({ ...s, subs: { ...s.subs, quiet: withUid(s.subs.quiet, uid, quiet) } });

// What a screen shows now. A line the editor typed takes over. `seen` is when this screen first saw each line (its own clock, so a
// phone whose clock is wrong still shows and clears lines on time).
export const subKey = (l: Pick<SubLine, "uid" | "at">) => `${l.uid}@${l.at}`;
export function shownSubs(s: Pick<StudioState, "caption" | "subs" | "said">, seen: Readonly<Record<string, number>>, now: number): { line: SubLine; word: number; name: string }[] {
  if (s.caption || !s.subs.on) return [];
  return s.said.filter((l) => seen[subKey(l)] !== undefined && now - seen[subKey(l)] < l.ms + SUBS.holdMs).slice(-SUBS.lines).map((line) => {
    const words = line.text.split(" ").length, gone = now - seen[subKey(line)];
    // The highlight moves through the line at an even pace while it was being said, then rests on the last word.
    return { line, word: Math.min(words - 1, Math.floor((gone / line.ms) * words)), name: s.subs.names && !line.solo ? line.name : "" };
  });
}

