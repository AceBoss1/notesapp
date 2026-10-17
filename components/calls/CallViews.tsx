"use client";

import { useEffect, useRef, useState, type ReactNode, type Ref } from "react";
import Avatar from "@/components/Avatar";
import { DEFAULT_AVATAR } from "@/lib/admin";
import type { CallKind } from "@/lib/calls";

// The call screens, drawn from plain props (CallManager owns the call itself). Also renderable on their own with made-up values.

const GLOW_CALL = "radial-gradient(ellipse 70% 55% at 50% 55%, rgba(78,1,25,0.8) 0%, rgba(78,1,25,0.3) 45%, rgba(26,18,16,0) 78%)";
const GLOW_INCOMING = "radial-gradient(ellipse 75% 60% at 50% 50%, rgba(122,3,40,0.65) 0%, rgba(78,1,25,0.35) 45%, rgba(26,18,16,0) 82%)";
const APP_ICON = "/images/brand/notesapp-icon.webp";
const noun = (k: CallKind) => (k === "video" ? "video call" : "voice call");

const Icon = ({ children, className = "h-7 w-7 lg:h-[22px] lg:w-[22px]" }: { children: ReactNode; className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>{children}</svg>
);
const MicIcon = ({ off }: { off?: boolean }) => (
  <Icon><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0013 0M12 17.5V21" />{off && <path d="M4 4l16 16" />}</Icon>
);
const FlipIcon = () => (
  <Icon><path d="M3.5 8.5h3l1.8-2.5h7.4l1.8 2.5h3v10h-17z" /><path d="M9.3 12.6a2.9 2.9 0 015.1-1.2M14.7 14.4a2.9 2.9 0 01-5.1 1.2" /><path d="M14.6 9.8v1.8h-1.8M9.4 17.2v-1.8h1.8" /></Icon>
);
const CameraIcon = ({ off }: { off?: boolean }) => (
  <Icon><rect x="2.5" y="6.5" width="13.5" height="11" rx="2" /><path d="M16 10.5l5.5-3v9l-5.5-3z" />{off && <path d="M3 3.5l17 17" />}</Icon>
);
const CrossIcon = ({ className }: { className?: string }) => <Icon className={className}><path d="M6 6l12 12M18 6L6 18" /></Icon>;
const PhoneIcon = ({ className }: { className?: string }) => (
  <Icon className={className}><path d="M21 16.4v2.8a1.9 1.9 0 01-2 1.9 18.7 18.7 0 01-8.2-2.9 18.4 18.4 0 01-5.7-5.7A18.7 18.7 0 012.2 4.2 1.9 1.9 0 014.1 2.2h2.8a1.9 1.9 0 011.9 1.6c.1.9.3 1.7.6 2.5a1.9 1.9 0 01-.4 2L7.8 9.5a15.2 15.2 0 005.7 5.7l1.2-1.2a1.9 1.9 0 012-.4c.8.3 1.6.5 2.5.6a1.9 1.9 0 011.6 1.9z" /></Icon>
);

// Their picture in a ring, or their initials when they have no picture of their own.
function CallAvatar({ src, name, ring }: { src: string; name: string; ring: "gold" | "white" }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "?";
  const gold = ring === "gold";
  return (
    <div className={`flex h-[142px] w-[142px] shrink-0 items-center justify-center overflow-hidden rounded-full border-[3px] lg:h-[162px] lg:w-[162px] ${gold ? "border-[#C9A227] bg-[#241C1A] text-[#C9A227]" : "border-white bg-crimson text-white"}`}>
      {src && src !== DEFAULT_AVATAR
        ? <Avatar src={src} alt="" size={156} className="!h-full !w-full !border-0" />
        : <span aria-hidden className={`font-display text-[44px] leading-none lg:text-[50px] ${gold ? "font-bold" : ""}`}>{initials}</span>}
    </div>
  );
}

// A round control; the label under it only shows on phones (desktop has the tooltip).
function CallButton({ label, aria, onClick, disabled, pressed, end, children }: { label: string; aria: string; onClick: () => void; disabled?: boolean; pressed?: boolean; end?: boolean; children: ReactNode }) {
  const look = end ? "h-[72px] w-[72px] bg-[#E5383B] hover:bg-[#D12F32] lg:h-16 lg:w-16" : `h-16 w-16 lg:h-14 lg:w-14 ${pressed ? "bg-white text-ink" : "bg-white/[0.12] hover:bg-white/20"}`;
  return (
    <div className="flex w-[72px] flex-col items-center gap-2.5 lg:w-auto">
      <div className="flex h-[72px] items-center lg:h-16">
        <button type="button" onClick={onClick} disabled={disabled} aria-pressed={pressed} aria-label={aria} title={aria}
          className={`flex items-center justify-center rounded-full transition-colors disabled:opacity-40 ${look}`}>
          {children}
        </button>
      </div>
      <span aria-hidden className="font-ui text-[13px] text-white/70 lg:hidden">{label}</span>
    </div>
  );
}

export type CallStageProps = {
  kind: CallKind; name: string; avatar: string; status: string;
  live: boolean; over: boolean;
  muted: boolean; camOff: boolean; canFlip: boolean; facing: "user" | "environment";
  onMute: () => void; onFlip: () => void; onCam: () => void; onEnd: () => void;
  remoteVideo?: Ref<HTMLVideoElement>; localVideo?: Ref<HTMLVideoElement>; remoteAudio?: Ref<HTMLAudioElement>;
};

export function CallStage({ kind, name, avatar, status, live, over, muted, camOff, canFlip, facing, onMute, onFlip, onCam, onEnd, remoteVideo, localVideo, remoteAudio }: CallStageProps) {
  const [swapped, setSwapped] = useState(false); // you big, them small
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null); // where the small picture was dragged to
  const drag = useRef<{ dx: number; dy: number; moved: boolean } | null>(null);

  // The small picture: drag it anywhere; a tap (no drag) swaps which picture is big.
  const onDown = (e: React.PointerEvent<HTMLElement>) => { const r = e.currentTarget.getBoundingClientRect(); drag.current = { dx: e.clientX - r.left, dy: e.clientY - r.top, moved: false }; e.currentTarget.setPointerCapture(e.pointerId); };
  const onMove = (e: React.PointerEvent<HTMLElement>) => {
    const d = drag.current; if (!d) return;
    const w = e.currentTarget.offsetWidth, h = e.currentTarget.offsetHeight;
    const x = Math.min(window.innerWidth - w - 8, Math.max(8, e.clientX - d.dx)), y = Math.min(window.innerHeight - h - 8, Math.max(8, e.clientY - d.dy));
    if (!d.moved && pos && Math.abs(x - pos.x) + Math.abs(y - pos.y) < 6) return;
    d.moved = true; setPos({ x, y });
  };
  const onUp = () => { const d = drag.current; drag.current = null; if (d && !d.moved) setSwapped((v) => !v); };
  const liveVideo = kind === "video" && live;

  return (
    <div className="fixed inset-0 z-[130] flex flex-col overflow-hidden bg-ink text-white" style={{ backgroundImage: GLOW_CALL }} role="dialog" aria-modal="true" aria-label={`${kind === "video" ? "Video" : "Voice"} call with ${name}`}>
      {kind === "video" && (() => {
        // Two pictures: one fills the screen, the other is a small tile (top right on phones, bottom right on desktop; draggable; tap to swap).
        // Your own picture is mirrored when it's the front camera. The elements stay put when swapped, only their classes change, so the streams stay attached.
        const big = "absolute inset-0";
        const small = `absolute z-20 h-[150px] w-[104px] touch-none cursor-grab overflow-hidden rounded-2xl bg-white/10 shadow-xl lg:h-[220px] lg:w-40 ${pos ? "" : "right-4 top-[calc(env(safe-area-inset-top)_+_1.5rem)] lg:bottom-[7.5rem] lg:right-10 lg:top-auto"}`;
        const smallStyle = pos ? { left: pos.x, top: pos.y } : undefined;
        const mirror = facing === "user" ? { transform: "scaleX(-1)" } : undefined;
        const handlers = { onPointerDown: onDown, onPointerMove: onMove, onPointerUp: onUp, title: "Drag to move · tap to swap" };
        return <>
          <div className={swapped ? small : big} style={swapped ? smallStyle : undefined} {...(swapped ? handlers : {})}>
            <video ref={remoteVideo} autoPlay playsInline className="h-full w-full object-cover" />
          </div>
          <div className={swapped ? big : small} style={swapped ? undefined : smallStyle} {...(swapped ? {} : handlers)}>
            {!swapped && <span className="absolute inset-0 flex items-center justify-center font-ui text-sm text-white/60">You</span>}
            <video ref={localVideo} autoPlay playsInline muted className={`relative h-full w-full object-cover ${camOff ? "opacity-30" : ""}`} style={mirror} />
          </div>
        </>;
      })()}
      <audio ref={remoteAudio} autoPlay className="hidden" />
      {liveVideo && <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 z-[5] h-80 bg-gradient-to-t from-black/70 to-transparent" />}

      {/* Once a video call is up, the name moves down out of the way of their face. */}
      <div className={`relative z-10 flex flex-1 flex-col items-center px-6 text-center ${liveVideo ? "justify-end pb-6" : "justify-center pt-[env(safe-area-inset-top)] lg:pb-16"}`}>
        {(kind === "audio" || !live) && <CallAvatar src={avatar} name={name} ring="gold" />}
        <p className={`max-w-full break-words font-display leading-tight drop-shadow ${liveVideo ? "text-2xl lg:text-3xl" : "mt-6 text-[34px] lg:text-[44px]"}`}>{name}</p>
        <p className={`font-mono text-[15px] text-white/60 drop-shadow lg:text-sm ${liveVideo ? "mt-1.5" : "mt-4"}`} aria-live="polite">{status}</p>
        {kind === "audio" && live && <p className="mt-2 font-ui text-xs text-white/45">Free call · phone to phone</p>}
      </div>

      <div className="relative z-10 flex items-start justify-center gap-4 px-4 pb-[calc(env(safe-area-inset-bottom)_+_1.75rem)] sm:gap-6 lg:items-center lg:gap-5 lg:pb-10">
        <CallButton label="Mute" aria={muted ? "Unmute" : "Mute"} pressed={muted} onClick={onMute} disabled={over}><MicIcon off={muted} /></CallButton>
        {kind === "video" && canFlip && <CallButton label="Flip" aria={facing === "user" ? "Switch to the back camera" : "Switch to the front camera"} onClick={onFlip} disabled={over || camOff}><FlipIcon /></CallButton>}
        {kind === "video" && <CallButton label="Camera" aria={camOff ? "Turn camera on" : "Turn camera off"} pressed={camOff} onClick={onCam} disabled={over}><CameraIcon off={camOff} /></CallButton>}
        <CallButton label="End" aria="End call" end onClick={onEnd} disabled={over}><CrossIcon className="h-8 w-8 lg:h-6 lg:w-6" /></CallButton>
      </div>
    </div>
  );
}

export type IncomingCallProps = { kind: CallKind; name: string; avatar: string; username?: string; onAccept: () => void; onDecline: () => void };

// Phones: the whole screen, like a phone call. Desktop: a card at the top right, over whatever page is open.
export function IncomingCall({ kind, name, avatar, username, onAccept, onDecline }: IncomingCallProps) {
  const [host, setHost] = useState("");
  useEffect(() => setHost(window.location.host), []);
  const label = `Incoming ${noun(kind)} from ${name}`;
  const title = `Incoming ${noun(kind)}`;
  const sub = `${name} is calling you on #NotesApp`;

  return (
    <>
      <div className="fixed inset-0 z-[120] flex flex-col bg-ink text-white lg:hidden" style={{ backgroundImage: GLOW_INCOMING }} role="alertdialog" aria-label={label}>
        <div className="px-3 pt-[calc(env(safe-area-inset-top)_+_0.5rem)]">
          <div className="flex items-center gap-3 rounded-3xl bg-white/10 px-3 py-3.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={APP_ICON} alt="" width={44} height={44} className="h-11 w-11 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1 font-ui">
              <p className="text-[15px] font-semibold">{title}</p>
              <p className="text-[13px] text-white/75">{sub}</p>
            </div>
          </div>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <p className="font-mono text-[13px] uppercase tracking-eyebrow text-paper/80">#NotesApp {noun(kind)}</p>
          <div className="mt-4"><CallAvatar src={avatar} name={name} ring="white" /></div>
          <p className="mt-6 max-w-full break-words font-display text-[36px] leading-tight">{name}</p>
          <p className="mt-4 font-ui text-[15px] text-white/75">{username ? `@${username} · ` : ""}calling…</p>
        </div>
        <div className="flex justify-between px-12 pb-[calc(env(safe-area-inset-bottom)_+_2.5rem)] min-[380px]:px-16">
          <div className="flex flex-col items-center gap-3">
            <button type="button" onClick={onDecline} aria-label="Decline" className="flex h-[76px] w-[76px] items-center justify-center rounded-full bg-[#E5383B] hover:bg-[#D12F32]"><CrossIcon className="h-9 w-9" /></button>
            <span aria-hidden className="font-ui text-[15px] text-white/80">Decline</span>
          </div>
          <div className="flex flex-col items-center gap-3">
            <button type="button" onClick={onAccept} aria-label="Answer" className="flex h-[76px] w-[76px] items-center justify-center rounded-full bg-[#2FA36B] hover:bg-[#29925F]"><PhoneIcon className="h-8 w-8" /></button>
            <span aria-hidden className="font-ui text-[15px] text-white/80">Answer</span>
          </div>
        </div>
      </div>

      <div className="fixed right-10 top-10 z-[120] hidden w-[400px] rounded-2xl border border-white/10 bg-[#2A2321] p-[18px] text-white shadow-2xl lg:block" role="alertdialog" aria-label={label}>
        <div className="flex gap-3.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={APP_ICON} alt="" width={56} height={56} className="h-14 w-14 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1 pt-0.5 font-ui">
            <p className="text-[15px] font-semibold">{title}</p>
            <p className="mt-0.5 text-[13px] text-white/80">{sub}</p>
            {host && <p className="mt-1 text-[11px] text-white/40">{host}</p>}
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <button type="button" onClick={onAccept} className="h-12 rounded-xl bg-[#2FA36B] font-ui text-sm font-bold hover:bg-[#29925F]">Answer</button>
          <button type="button" onClick={onDecline} className="h-12 rounded-xl bg-white/10 font-ui text-sm font-bold hover:bg-white/15">Decline</button>
        </div>
      </div>
    </>
  );
}
