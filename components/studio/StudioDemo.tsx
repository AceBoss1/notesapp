"use client";

import { useEffect, useRef, useState } from "react";
import ProgramFrame from "./ProgramFrame";
import StudioShell, { Backstage, Icon, LayoutBar, Sheet, SettingRow, ring, type BackstagePerson, type Control } from "./StudioShell";
import { BannersPanel, BrandPanel, EmptyNote, MediaPanel, OnAirQueue, Toggle, useDesk } from "./StudioPanels";
import { DEFAULT_STUDIO, applyStudioPatch, cleanComment, queueWith, sayLine, subsFor, type StudioState } from "@/lib/studio";

// Media Live Studio PRO to try on /studio: the real programme picture, chrome and panels, changed only on this screen (uploads are
// left out: the logo, clips and sponsor spot need a live). The same rules clean what is typed as in a real live (lib/studio.ts).
// Cam and Share screen use this device's own camera or screen as a preview; nothing is sent anywhere.
const PEOPLE: Record<string, { name: string; avatar: string; role: string }> = {
  host: { name: "Tunde Bakare", avatar: "", role: "Host" }, g1: { name: "Dr. Naledi Mokoena", avatar: "", role: "Guest" },
  g2: { name: "Zanele Dube", avatar: "", role: "Guest" }, g3: { name: "Kwame Asante", avatar: "", role: "Guest" },
};
const SAMPLE = [
  { id: "c1", from: "v1", name: "Efua Addo", avatar: "", text: "We need to re-embrace our culture and survive economically, looking at the current state of affairs." },
  { id: "c2", from: "v2", name: "Jabari Mwangi", avatar: "", text: "The Oyo Empire had checks on the Alaafin long before Westminster. Why is this not in our syllabus?" },
  { id: "c3", from: "v3", name: "Sade Okonkwo", avatar: "", text: "Question for Dr. Mokoena: where should a parent start with a ten-year-old?" },
  { id: "c4", from: "v4", name: "Chidi Eze", avatar: "", text: "Watching from Enugu. The sound is perfect tonight!" },
];
const START: StudioState = {
  ...DEFAULT_STUDIO, on: false,
  bug: { ...DEFAULT_STUDIO.bug, show: "The Emerging Voices", place: "Lagos · Johannesburg · London" },
  lower: { on: true, style: "headline", kicker: "Tonight's question", head: "African Mental Freedom: reclaiming the levers through history", name: "Dr. Naledi Mokoena", role: "Historian and author" },
  ticker: { on: true, tag: "NOTES LIVE", speed: "normal", lines: ["Join the conversation: comment and the moderators may put you on air", "Next week: the Oyo Empire and what it teaches about institutions", "The replay is on NotesApp straight after"] },
  subs: { ...DEFAULT_STUDIO.subs, on: true },
  comment: cleanComment(SAMPLE[0], "host"),
};
const SEATS = 5; // the host and up to four on stage in the try-out

// What the people on stage "say" in the try-out, so automatic subtitles can be seen: one voice, then two at once.
const SPEECH: [who: string, text: string][] = [
  ["g1", "and if we do not teach our own history"], ["g1", "someone else will teach it for us"], ["host", "but who decides what is taught?"],
  ["g1", "that is exactly the question"], ["host", "let us take a comment from Accra"],
];
const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export default function StudioDemo() {
  const [studio, setStudio] = useState<StudioState>(START);
  const [stage, setStage] = useState<string[]>(["host", "g1", "g2"]);
  const backstage = Object.keys(PEOPLE).filter((u) => u !== "host" && !stage.includes(u));
  const stageRef = useRef(stage); stageRef.current = stage;
  const [note, setNote] = useState("");
  const flash = (m: string) => { setNote(m); setTimeout(() => setNote((n) => (n === m ? "" : n)), 3500); };
  const [muted, setMuted] = useState(false);
  const [cam, setCam] = useState<MediaStream | null>(null);
  const [screen, setScreen] = useState(false);
  const [cc, setCc] = useState(true);
  const [settings, setSettings] = useState(false);
  const [secs, setSecs] = useState(0);
  useEffect(() => { if (!studio.on) { setSecs(0); return; } const t = setInterval(() => setSecs((s) => s + 1), 1000); return () => clearInterval(t); }, [studio.on]);
  useEffect(() => () => cam?.getTracks().forEach((t) => t.stop()), [cam]);

  const subsOn = studio.subs.on;
  useEffect(() => {
    if (!subsOn) return;
    let i = 0;
    const speak = () => {
      const [uid, text] = SPEECH[i++ % SPEECH.length];
      if (!stageRef.current.includes(uid)) return;
      setStudio((cur) => { const out = sayLine(cur, { uid, name: PEOPLE[uid].name, text, ms: 3200 }, { stage: stageRef.current, now: new Date() }); return out.ok ? out.studio : cur; });
    };
    speak();
    const t = setInterval(speak, 3400);
    return () => clearInterval(t);
  }, [subsOn]);

  const act = async (body: Record<string, unknown>) => {
    setStudio((cur) => {
      switch (body.op) {
        case "on": return { ...cur, on: body.on === true };
        case "set": { const out = applyStudioPatch(cur, body.patch, { file: (u) => (u ? null : ""), stage }); if (!out.ok) { flash(out.error); return cur; } return out.studio; }
        case "comment": { const c = cleanComment(body.message, "host"); return { ...cur, comment: c, queue: c ? cur.queue.filter((q) => q.id !== c.id) : cur.queue }; }
        case "queue": { const c = cleanComment(body.message, "host"); return c ? { ...cur, queue: queueWith(cur.queue, c) } : cur; }
        case "unqueue": return { ...cur, queue: cur.queue.filter((q) => q.id !== body.messageId) };
        case "clip": return { ...cur, clip: null };
        case "subsfor": return subsFor(cur, String(body.uid), body.off === true);
        default: return cur;
      }
    });
  };
  const onError = (m: string) => flash(/upload|sign in/i.test(m) ? "Uploads work in a real live: this is a try-out." : m);
  const desk = useDesk(act, onError);

  // This device's camera or screen, as the host's picture (a preview only).
  const stopVideo = () => { cam?.getTracks().forEach((t) => t.stop()); setCam(null); if (screen) { setScreen(false); setStudio((s) => ({ ...s, screen: "" })); } };
  const toggleCam = async () => {
    if (cam && !screen) { stopVideo(); return; }
    stopVideo();
    try { setCam(await navigator.mediaDevices.getUserMedia({ video: true, audio: false })); } catch { flash("Allow the camera to see yourself here. Nothing is sent: this is a try-out."); }
  };
  const toggleScreen = async () => {
    if (screen) { stopVideo(); return; }
    try {
      const s = await navigator.mediaDevices.getDisplayMedia({ video: true });
      cam?.getTracks().forEach((t) => t.stop());
      s.getVideoTracks()[0]?.addEventListener("ended", () => { setCam(null); setScreen(false); setStudio((x) => ({ ...x, screen: "" })); });
      setCam(s); setScreen(true); setStudio((x) => ({ ...x, screen: "host" }));
    } catch { flash("Sharing was cancelled."); }
  };
  const toStage = (u: string, on: boolean) => {
    if (on && stage.length >= SEATS) { flash("Every seat is taken. Take someone off the stage first."); return; }
    setStage((s) => (on ? [...s, u] : s.filter((x) => x !== u)));
    if (!on) setStudio((s) => ({ ...s, focus: s.focus === u ? "" : s.focus }));
  };

  const people: BackstagePerson[] = [
    ...stage.map((u): BackstagePerson => ({
      uid: u, name: u === "host" ? `${PEOPLE[u].name} (you)` : PEOPLE[u].name, avatar: "", stream: u === "host" ? cam : null, mirror: u === "host" && !screen,
      onStage: true, badge: PEOPLE[u].role, micOff: u === "host" && muted, talking: studio.said.at(-1)?.uid === u, focus: studio.layout !== "auto" && studio.layout !== "grid" && (studio.focus || "host") === u,
      primary: u === "host" ? undefined : { label: "Remove from stage", run: () => toStage(u, false) },
      actions: [
        ...(stage.length > 1 ? [{ label: "Put in focus", run: () => void desk.set("focus", { focus: u === "host" ? "" : u }) }] : []),
        { label: "Name in the lower third", run: () => void desk.set("lower", { lower: { name: PEOPLE[u].name, role: PEOPLE[u].role === "Host" ? "Host" : studio.lower.role, on: true } }) },
        ...(u !== "host" ? [{ label: "Remove from stage", run: () => toStage(u, false), danger: true }] : []),
      ],
    })),
    ...backstage.map((u): BackstagePerson => ({
      uid: u, name: PEOPLE[u].name, avatar: "", stream: null, onStage: false, badge: u === "g3" ? "Asked to come on stage" : "Backstage", waiting: u === "g3" ? "Hand up" : undefined,
      primary: { label: "Add to stage", run: () => toStage(u, true) }, actions: [{ label: "Add to stage", run: () => toStage(u, true) }],
    })),
  ];
  const controls: Control[] = [
    { id: "mic", label: muted ? "Unmute" : "Mic", icon: muted ? "micOff" : "mic", off: muted, pressed: muted, tip: muted ? "Turn your microphone on" : "Mute your microphone", onClick: () => setMuted((m) => !m) },
    { id: "cam", label: cam && !screen ? "Cam" : "Cam off", icon: cam && !screen ? "cam" : "camOff", off: !cam || screen, tip: cam && !screen ? "Turn your camera off" : "Turn your camera on", onClick: () => void toggleCam() },
    { id: "screen", label: screen ? "Stop share" : "Share", icon: "screen", active: screen, pressed: screen, tip: screen ? "Stop sharing your screen" : "Share your screen", onClick: () => void toggleScreen() },
    { id: "invite", label: "Invite", icon: "invite", tip: "Copy the guest link", onClick: () => flash("In a live, this copies the live's link: guests open it and ask to come on stage.") },
    { id: "settings", label: "Settings", icon: "settings", expanded: settings, tip: "Studio settings", onClick: () => setSettings(true) },
    { id: "leave", label: "Leave", icon: "leave", danger: true, tip: "Leave the studio", onClick: () => flash("In a live, this leaves the studio. This is a try-out.") },
  ];
  const queued = new Set(studio.queue.map((q) => q.id));

  return (
    <StudioShell embedded title="African Mental Freedom: reclaiming the levers through history"
      destination={<>
        <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-[#35C27A]" />NotesApp Live · The Emerging Voices</span>
        <span className="rounded-full border border-dashed border-white/25 px-2 py-px text-white/50" title="Sending the same programme to LinkedIn Live is being built">LinkedIn Live · coming soon</span>
      </>}
      status={{ live: studio.on, time: clock(secs), viewers: studio.on ? "1,284 watching" : undefined, preview: "Preview · not live" }}
      primary={studio.on
        ? <button type="button" onClick={() => { void act({ op: "on", on: false }); flash("Broadcast ended. (A try-out: nothing was sent.)"); }} className={`rounded-lg bg-[#E5122F] px-4 py-2 font-ui text-sm font-bold hover:bg-[#c90f28] ${ring}`}>End broadcast</button>
        : <button type="button" onClick={() => void act({ op: "on", on: true })} className={`rounded-lg bg-[#E5122F] px-4 py-2 font-ui text-sm font-bold shadow-[0_0_0_3px_rgba(229,18,47,0.25)] hover:bg-[#c90f28] ${ring}`}>Go live</button>}
      notice={note ? <p className="rounded-lg bg-white/10 px-3 py-2 text-xs" role="status">{note}</p> : undefined}
      stage={<ProgramFrame studio={studio} stage={stage} hostUid="host" me="host" person={(u) => PEOPLE[u]} videos={{}} myCam={cam} talking={studio.said.length ? { [studio.said.at(-1)!.uid]: true } : {}} sub={(u) => (u === "host" ? "Host" : "")} hideSubs={!cc} />}
      layoutBar={<LayoutBar layout={studio.layout} busy={desk.busy === "layout"} onPick={(l) => void desk.set("layout", { layout: l })} screen={studio.screen ? PEOPLE[studio.screen]?.name : ""} />}
      backstage={<Backstage people={people} empty={Math.max(0, SEATS + 1 - stage.length - backstage.length)} onInvite={() => flash("In a live, this copies the live's link for a guest.")} inviteHint="Invite a guest" />}
      controls={controls}
      tabs={[
        {
          id: "comments", label: "Comments", icon: "comments", badge: SAMPLE.length, body: (
            <div className="space-y-3 p-3">
              <OnAirQueue studio={studio} desk={desk} />
              <ul className="space-y-2">
                {SAMPLE.map((m) => {
                  const airing = studio.comment?.id === m.id;
                  return (
                    <li key={m.id} className={`rounded-lg p-3 text-sm ${airing ? "bg-[#E5122F]/15 ring-1 ring-[#E5122F]" : "bg-white/[0.05]"}`}>
                      <b className="font-ui text-xs">{m.name}</b>
                      <p className="mt-0.5 text-white/85">{m.text}</p>
                      <div className="mt-2 flex gap-2 text-[11px]">
                        {airing
                          ? <button type="button" onClick={() => void act({ op: "comment", message: null })} className={`rounded bg-[#E5122F] px-2 py-1 font-extrabold ${ring}`}>On stage · take off</button>
                          : <button type="button" onClick={() => void act({ op: "comment", message: m })} className={`rounded bg-white px-2 py-1 font-extrabold text-ink ${ring}`}>Show on stage</button>}
                        {!airing && <button type="button" disabled={queued.has(m.id)} onClick={() => void act({ op: "queue", message: m })} className={`rounded bg-white/10 px-2 py-1 font-semibold hover:bg-white/20 disabled:opacity-40 ${ring}`}>{queued.has(m.id) ? "Queued" : "Queue"}</button>}
                      </div>
                    </li>
                  );
                })}
              </ul>
              <p className="text-[11px] text-white/45">In a live, the moderators who may put comments on air see these buttons beside each comment in the chat.</p>
            </div>
          ),
        },
        { id: "banners", label: "Banners", icon: "banners", body: <BannersPanel studio={studio} stage={stage} nameOf={(u) => PEOPLE[u]?.name ?? "Guest"} desk={desk} tryOut /> },
        { id: "brand", label: "Brand", icon: "brand", body: <BrandPanel studio={studio} desk={desk} onError={onError} /> },
        { id: "media", label: "Media", icon: "media", body: <MediaPanel studio={studio} desk={desk} onError={onError} /> },
        {
          id: "recording", label: "Recording", icon: "rec", body: (
            <EmptyNote icon="rec" title="Recording is chosen when the live starts">
              Tick <b>Record this live</b> on Go live. Everyone who joins is told, speakers agree before their mic goes on, and the replay is yours to publish. A red <b>REC</b> shows in the top bar while it records.
            </EmptyNote>
          ),
        },
      ]}
      overlay={settings && (
        <Sheet title="Studio settings" onClose={() => setSettings(false)}>
          <SettingRow label="Subtitles on my screen" hint="Only changes what you see (CC)"><Toggle on={cc} onChange={setCc} label="Subtitles on my screen" /></SettingRow>
          <SettingRow label="Editors and moderators" hint="In a live, the host names who runs the graphics and the comments"><span className="flex items-center gap-1 text-xs text-white/50"><Icon name="lock" className="h-3.5 w-3.5" />In a live</span></SettingRow>
          <SettingRow label="Stream to LinkedIn Live" hint="The same programme, at the same time"><span className="text-xs text-white/50">Coming soon</span></SettingRow>
        </Sheet>
      )}
    />
  );
}
