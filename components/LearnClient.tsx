"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { deviceLabel, getDeviceId } from "@/lib/device";
import PdfViewer from "@/components/PdfViewer";

type Lesson = { id: string; title: string; kind: "video" | "pdf"; durationSec?: number };
type Dev = { id: string; label: string; lastAt: string; current: boolean };
type Opened = { title: string; email: string; lessons: Lesson[]; used: number; max: number; isNew: boolean; devices: Dev[] };
type Blocked = { error: string; attempt: number; used: number; max: number; devices: Dev[] };

const mins = (s?: number) => (s ? `${Math.max(1, Math.round(s / 60))} min` : "");

// The player for a view-only purchase: opens it on this device (2 per purchase, unlimited sessions), then plays video
// lessons from Cloudflare Stream and draws PDF lessons in the page. Nothing here offers a download.
export default function LearnClient({ reference }: { reference: string }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [open, setOpen] = useState<Opened | null>(null);
  const [blocked, setBlocked] = useState<Blocked | null>(null);
  const [error, setError] = useState("");
  const [current, setCurrent] = useState<Lesson | null>(null);
  const [src, setSrc] = useState("");
  const [lessonError, setLessonError] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  const call = useCallback(async (u: User, path: string, body: Record<string, unknown>) => {
    return fetch(path, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${await u.getIdToken()}` }, body: JSON.stringify({ reference, deviceId: getDeviceId(), ...body }) });
  }, [reference]);

  const start = useCallback(async (u: User) => {
    setError("");
    const res = await call(u, "/api/store/view", { label: deviceLabel() });
    const j = await res.json();
    if (res.status === 403 && j.code === "device_limit") {
      setBlocked(j);
      setOpen(null);
      return;
    }
    if (!res.ok) return setError(j.error || "Couldn't open this.");
    setBlocked(null);
    setOpen(j);
    setCurrent((c) => c ?? j.lessons[0] ?? null);
  }, [call]);

  useEffect(() => {
    if (user) void start(user);
  }, [user, start]);

  useEffect(() => {
    if (!user || !current || !open) return;
    setSrc("");
    setLessonError("");
    if (current.kind !== "video") return;
    let dead = false;
    call(user, "/api/store/view/lesson", { lessonId: current.id })
      .then(async (r) => {
        const j = await r.json();
        if (dead) return;
        if (!r.ok) return setLessonError(j.error || "Couldn't play this lesson.");
        setSrc(j.src);
      })
      .catch(() => !dead && setLessonError("Couldn't play this lesson."));
    return () => {
      dead = true;
    };
  }, [user, current, open, call]);

  const loadPdf = useCallback(async () => {
    const res = await call(user!, "/api/store/view/lesson", { lessonId: current!.id, bytes: true });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Couldn't open this file.");
    return res.arrayBuffer();
  }, [call, user, current]);

  async function removeDevice(id: string) {
    if (!user || !confirm("Remove this device? It won't be able to open this purchase unless you register it again.")) return;
    const res = await call(user, "/api/store/view/devices", { remove: id });
    const j = await res.json();
    if (!res.ok) return setNote(j.error || "Couldn't remove it.");
    setNote(`Device removed. You can remove ${j.removalsLeft} more this month.`);
    await start(user);
  }

  if (user === undefined) return <div className="mx-auto max-w-3xl px-4 py-16 text-sm text-slate">Loading…</div>;
  if (!user) return <div className="mx-auto max-w-3xl px-4 py-16 text-sm"><p className="text-ink">Sign in to open your purchase.</p><Link href={`/login`} className="btn-primary mt-4 inline-block">Sign in</Link></div>;

  const devices = (blocked?.devices ?? open?.devices) || [];
  const deviceList = (
    <ul className="mt-2 space-y-1 text-xs">
      {devices.map((d) => (
        <li key={d.id} className="flex items-center justify-between gap-3 border border-rule px-3 py-1.5">
          <span className="text-ink">{d.label}{d.current ? " (this device)" : ""} <span className="font-mono text-slate">· last used {new Date(d.lastAt).toLocaleDateString("en-NG")}</span></span>
          <button onClick={() => removeDevice(d.id)} className="font-semibold text-crimson">Remove</button>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <Link href="/orders" className="text-xs font-semibold text-crimson">← My orders</Link>
      {error && <p className="mt-4 text-sm text-crimson">{error}</p>}
      {blocked && (
        <div className="card mt-4 border-crimson p-5 text-sm">
          <p className="font-ui font-bold text-crimson">Blocked attempt #{blocked.attempt}</p>
          <p className="mt-1 text-slate">This purchase is already registered on {blocked.max} devices ({blocked.used} of {blocked.max} used), and this is a third one. Open it on a device you already use, or free a slot by removing one below.</p>
          {deviceList}
          {note && <p className="mt-2 text-xs text-slate">{note}</p>}
        </div>
      )}
      {open && (
        <>
          <h1 className="mt-3 font-display text-3xl text-ink">{open.title}</h1>
          <p className="mt-1 text-xs text-slate">
            {open.isNew ? `This device is now registered — device ${open.used} of ${open.max}${open.used >= open.max ? "; no more devices can be added." : "."}` : `Registered devices: ${open.used} of ${open.max}.`}{" "}
            Unlimited viewing on these devices. <details className="mt-1 inline-block"><summary className="cursor-pointer font-semibold text-crimson">Manage devices</summary>{deviceList}{note && <span className="mt-1 block">{note}</span>}</details>
          </p>
          <div className="mt-6 grid gap-6 lg:grid-cols-[16rem_1fr]">
            {open.lessons.length > 1 && (
              <ol className="space-y-1 text-sm">
                {open.lessons.map((l, i) => (
                  <li key={l.id}>
                    <button onClick={() => setCurrent(l)} className={`w-full border px-3 py-2 text-left ${current?.id === l.id ? "border-crimson bg-crimson/5 text-ink" : "border-rule text-slate hover:border-crimson"}`}>
                      {i + 1}. {l.title} <span className="font-mono text-[10px]">{l.kind === "video" ? `video ${mins(l.durationSec)}` : "PDF"}</span>
                    </button>
                  </li>
                ))}
              </ol>
            )}
            <div className={open.lessons.length > 1 ? "" : "lg:col-span-2"}>
              {current && <h2 className="mb-3 font-ui text-lg font-bold text-ink">{current.title}</h2>}
              {lessonError && <p className="text-sm text-crimson">{lessonError}</p>}
              {current?.kind === "video" && !lessonError && (
                <div className="relative aspect-video w-full overflow-hidden bg-black" onContextMenu={(e) => e.preventDefault()}>
                  {src ? <iframe src={src} title={current.title} className="absolute inset-0 h-full w-full border-0" allow="accelerometer; gyroscope; encrypted-media; picture-in-picture" allowFullScreen /> : <p className="p-4 text-sm text-white/70">Loading video…</p>}
                  <span className="pointer-events-none absolute left-3 top-3 select-none font-mono text-[11px] text-white/40">{open.email}</span>
                </div>
              )}
              {current?.kind === "pdf" && <PdfViewer key={current.id} load={loadPdf} watermark={open.email} />}
              <p className="mt-4 text-xs text-slate">View-only: this can&apos;t be downloaded, and sharing your access isn&apos;t allowed — it&apos;s tied to your account and two devices.</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
