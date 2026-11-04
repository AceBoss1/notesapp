// Recording a live (an audio room on the relay) and publishing the replay (owner, 2 Nov 2026). Pure and client-safe: the settings, who
// must be told and who must agree, the keep dates, and who a replay may reach. The server side is lib/live-recording-server.ts; the
// recorder itself is a small service (services/room-recorder) that joins the room as a silent, receive-only participant.
//
// The decided rules (docs/BUILD_LOG.md, "Recording for safety review, with the host's consent"):
// - The host switches recording on before going live (off by default; Admin can force it on for safety later). Only relay rooms can be
//   recorded, because the recorder joins through the relay; a room that falls back to phone to phone is not recorded, and the host is told.
// - Everyone who joins sees "This live is being recorded" before they use a microphone; a speaker brought on stage taps once to agree
//   before their microphone goes up (the server refuses their microphone until then: lib/rooms.ts canPush).
// - Recordings are server-only (roomRecordings/{rid}), kept keepDays (30) after the room ends, then deleted by the cron unless the host
//   publishes the replay. Admins with the moderation role can play any recording (safety review); hosts play their own.
// - A published replay (replays/{id}) streams from Cloudflare Stream. It shows in the host's Media area, on Explore and on Trending; it
//   becomes a journal post only when the host taps Share to Journal (a draft with the replay, the transcript and Nana's summary).
//   Unpublishing removes the replay and its post, and restarts the keep timer only if the recording is still inside its first window.

// ── Settings (Admin → Limits → Live recording; serverConfig/recording, read through lib/live-recording-server.ts) ──
export type RecordingSettingKey = "keepDays" | "maxHours" | "forceRecord";
export type RecordingSettingDef = { key: RecordingSettingKey; label: string; unit: string; min: number; max: number; def: number; kind?: "switch" };
export const RECORDING_SETTINGS: RecordingSettingDef[] = [
  { key: "keepDays", label: "Keep a recording this many days after the live ends, then delete it unless the host published the replay", unit: "days", min: 1, max: 365, def: 30 },
  { key: "maxHours", label: "Longest recording (the recorder stops at this length)", unit: "hours", min: 1, max: 12, def: 4 },
  { key: "forceRecord", label: "Record every relay room for safety review, whatever the host chooses (everyone is still told)", unit: "on/off", min: 0, max: 1, def: 0, kind: "switch" },
];
export type RecordingSettings = Record<RecordingSettingKey, number>;
export type RecordingOverrides = Partial<RecordingSettings>;
export const RECORDING_DEFAULTS = Object.fromEntries(RECORDING_SETTINGS.map((s) => [s.key, s.def])) as RecordingSettings;
export function recordingSettings(overrides: RecordingOverrides = {}): RecordingSettings {
  const out = { ...RECORDING_DEFAULTS };
  for (const s of RECORDING_SETTINGS) {
    const v = overrides[s.key];
    if (typeof v === "number" && Number.isInteger(v) && v >= s.min && v <= s.max) out[s.key] = v;
  }
  return out;
}
export function cleanRecordingOverrides(input: unknown): RecordingOverrides {
  const out: RecordingOverrides = {};
  if (!input || typeof input !== "object") return out;
  for (const s of RECORDING_SETTINGS) {
    const raw = (input as Record<string, unknown>)[s.key];
    const v = typeof raw === "boolean" && s.kind === "switch" ? (raw ? 1 : 0) : Number(raw);
    if (raw !== undefined && raw !== null && raw !== "" && Number.isInteger(v) && v >= s.min && v <= s.max && v !== s.def) out[s.key] = v;
  }
  return out;
}

// What the help, the Start a room form and the Replays list say, from the settings and whether the recorder is set up.
export type RecordingFigures = { available: boolean; forced: boolean; keepDays: number; maxHours: number; transcripts: boolean };
export const recordingFigures = (s: RecordingSettings = RECORDING_DEFAULTS, recorderReady = false, transcripts = false): RecordingFigures =>
  ({ available: recorderReady, forced: recorderReady && s.forceRecord > 0, keepDays: s.keepDays, maxHours: s.maxHours, transcripts });
export const DEFAULT_RECORDING_FIGURES = recordingFigures();

// The help article the notices link to (its words come from the live settings: lib/kb-articles.ts).
export const RECORDING_HELP = "/help/live-recording-and-replays";
export const RECORDING_NOTICE = "This live is being recorded";

// ── On the room (communityRooms/{id}, written by the server) ──
// recording: set when the room starts recorded. status follows the recorder: "starting" until it joins, "on" while it records, "failed"
// when it couldn't start (the room goes on; the host sees why). Everyone in the room is told while `on` is true, whatever the status.
export type RoomRecordingState = { on: true; rid: string; status: "starting" | "on" | "failed" | "stopped"; why?: string; forced?: boolean };
export type RecordingRoomFields = { hostUid: string; speakers: string[]; recording?: RoomRecordingState; consent?: Record<string, string> };

// Whether a room is being recorded (everyone sees the notice).
export const isRecorded = (r: Pick<RecordingRoomFields, "recording">) => r.recording?.on === true;
// Whether this person may use a microphone in this room as far as recording goes: always when it isn't recorded; the host agreed when
// they switched it on; a speaker after their one tap.
export const hasConsented = (r: Pick<RecordingRoomFields, "recording" | "consent" | "hostUid">, uid: string) =>
  !isRecorded(r) || uid === r.hostUid || !!r.consent?.[uid];
// What a person's screen shows about recording now: nothing; the notice (everyone in a recorded room); or the notice with the one-tap
// agreement (a speaker on stage who hasn't agreed yet, whose microphone stays off until they do).
export type RecordingPrompt = "none" | "notice" | "consent";
export function recordingPrompt(r: Pick<RecordingRoomFields, "recording" | "consent" | "hostUid" | "speakers">, uid: string): RecordingPrompt {
  if (!isRecorded(r)) return "none";
  if (r.speakers.includes(uid) && !hasConsented(r, uid)) return "consent";
  return "notice";
}
// Whether a new room records: the host's choice, or Admin's force switch; never without the recorder, and never phone to phone.
export const shouldRecord = (o: { asked: boolean; s: RecordingSettings; recorderReady: boolean; relay: boolean; planAllows: boolean }) =>
  o.recorderReady && o.relay && (o.s.forceRecord > 0 || (o.asked && o.planAllows));

// ── The recording (roomRecordings/{rid}, server-only) ──
export type RecordingFileKind = "stage" | "audio"; // stage: the picture (host video, or the poster / title card) with the mixed sound; audio: sound only
export const RECORDING_FILES: RecordingFileKind[] = ["stage", "audio"];
export type RecordingPart = { n: number; etag: string; size: number };
export type RecordingPending = { seq: number; size: number; key: string };
export type RecordingFile = { key: string; type: string; uploadId: string; parts: RecordingPart[]; pending: RecordingPending[]; lastSeq: number; size: number; done: boolean };
export type RecordingStatus = "starting" | "recording" | "finalizing" | "ready" | "failed" | "deleted";
export type RecordingDoc = {
  roomId: string; cid: string; communityName: string; title: string; hostUid: string; hostName: string;
  status: RecordingStatus; why?: string; forced?: boolean;
  startedAt: string; endedAt?: string; readyAt?: string; deletedAt?: string; deletedWhy?: "kept-days" | "host" | "unpublished-late";
  // When the cron deletes it (endedAt + keepDays), unless it's published. firstKeepUntil: the end of the first window (an unpublish
  // within it restarts the timer; after it, the recording goes).
  keepUntil?: string; firstKeepUntil?: string;
  published: boolean; replayId?: string;
  files: Partial<Record<RecordingFileKind, RecordingFile>>;
  hadVideo?: boolean; seconds?: number;
  // Everyone who agreed to speak on the record (the host first). teenOnStage: one of them is in teen mode, which keeps the replay inside
  // the community.
  stage: string[]; teenOnStage?: boolean;
  // Started in a room on the staff test pass (lib/staff-pass.ts): it may run to the top of the "Longest recording" range while the pass is on.
  staffPass?: boolean;
};

export const DAY_MS = 86_400_000;
// The keep date: keepDays after the live ended.
export const keepUntilFrom = (endedAt: string | Date, keepDays: number) => new Date(new Date(endedAt).getTime() + keepDays * DAY_MS).toISOString();
// Whole days left before deletion (0 on the last day; never negative), for the Replays list.
export const daysLeft = (keepUntil: string | undefined, now = Date.now()) => (keepUntil ? Math.max(0, Math.ceil((Date.parse(keepUntil) - now) / DAY_MS)) : 0);
// Due for deletion: past its keep date and not published (a recording that never got a keep date, stuck mid-way, uses its start).
export const dueForDeletion = (r: Pick<RecordingDoc, "keepUntil" | "published" | "status" | "startedAt">, keepDays: number, now = Date.now()) =>
  r.status !== "deleted" && !r.published && Date.parse(r.keepUntil ?? keepUntilFrom(r.startedAt, keepDays)) <= now;
// After an unpublish: inside the first window the timer restarts from now; after it, the recording is deleted now.
export function afterUnpublish(r: Pick<RecordingDoc, "firstKeepUntil" | "keepUntil">, keepDays: number, now = Date.now()): { keep: true; keepUntil: string } | { keep: false } {
  const first = Date.parse(r.firstKeepUntil ?? r.keepUntil ?? "");
  return Number.isFinite(first) && now < first ? { keep: true, keepUntil: new Date(now + keepDays * DAY_MS).toISOString() } : { keep: false };
}
// Multipart uploads need each part but the last to be at least 5 MiB, so the recorder's ~10-second chunks wait as small objects until
// enough have come in to make a part.
export const PART_MIN_BYTES = 5 * 1024 * 1024;
export const CHUNK_MAX_BYTES = 4 * 1024 * 1024; // one upload from the recorder (Vercel's request body limit is 4.5 MB)
export const partReady = (pending: Pick<RecordingPending, "size">[]) => pending.reduce((a, p) => a + p.size, 0) >= PART_MIN_BYTES;

// ── Replays (replays/{id}, server-only; read through /api/replays) ──
// public: anyone, listed on Explore and Trending. subscribers: the host's journal subscribers (a paid replay, like a premium post), listed
// with a "Subscribers" mark. community: members of the community the live was in, never listed.
export type ReplayAudience = "public" | "subscribers" | "community";
export const REPLAY_AUDIENCES: { id: ReplayAudience; label: string }[] = [
  { id: "public", label: "Everyone (shows on Explore and Trending)" },
  { id: "subscribers", label: "My journal subscribers (paid, like a premium post)" },
  { id: "community", label: "Members of the community only" },
];
export const isAudience = (v: unknown): v is ReplayAudience => v === "public" || v === "subscribers" || v === "community";
// Teen mode (lib/young.ts): a host in teen mode, or anyone in teen mode who spoke on the record, keeps the replay inside the community
// and off every public list.
export function audienceFor(asked: unknown, o: { hostTeen: boolean; teenOnStage: boolean }): { audience: ReplayAudience; why?: string } {
  const want: ReplayAudience = isAudience(asked) ? asked : "public";
  if ((o.hostTeen || o.teenOnStage) && want !== "community") return { audience: "community", why: o.hostTeen ? "Teen mode keeps your replays inside the community." : "Someone in teen mode spoke in this live, so its replay stays inside the community." };
  return { audience: want };
}
export const isListed = (audience: ReplayAudience) => audience !== "community";
export type ReplayStatus = "processing" | "ready" | "failed";
export type ReplayDoc = {
  rid: string; roomId: string; cid: string; communityName: string; hostUid: string; hostUsername: string; hostName: string; hostAvatar?: string;
  title: string; audience: ReplayAudience; listed: boolean; kind: "video" | "audio";
  status: ReplayStatus; streamUid: string; duration?: number; createdAt: string; publishedAt: string; views: number;
  noteId?: string; // the journal post made with Share to Journal
  transcript?: { status: "off" | "queued" | "ready" | "failed" | "too-long"; text?: string; why?: string };
};
export const REPLAY_TITLE_MAX = 120;
export const cleanReplayTitle = (v: unknown) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, REPLAY_TITLE_MAX);
// Who may watch: public, anyone; subscribers, the host and their subscribers; community, the host and the community's members.
export const mayWatch = (r: Pick<ReplayDoc, "audience" | "hostUid">, v: { uid?: string; subscribed: boolean; member: boolean; admin?: boolean }) =>
  r.audience === "public" || (!!v.uid && (v.uid === r.hostUid || !!v.admin || (r.audience === "subscribers" ? v.subscribed : v.member)));

// The journal draft made by Share to Journal: the summary and chapters (Nana's, for the host to edit), then the transcript. The replay
// itself is embedded by the journal page from the post's replayId; a "Book a session" card stays under every post.
export function replayJournalDraft(o: { title: string; summary?: string; transcript?: string; replayPath: string; transcriptNote?: string }): string {
  const parts = [
    `*A replay of the live "${o.title.replace(/[*_`]/g, "")}". [Watch it on its own page](${o.replayPath}).*`,
    "",
    o.summary?.trim() || "_Add a few lines about what was covered._",
  ];
  if (o.transcript?.trim()) parts.push("", "## Transcript", "", o.transcript.trim());
  else if (o.transcriptNote) parts.push("", `_${o.transcriptNote}_`);
  return parts.join("\n");
}
