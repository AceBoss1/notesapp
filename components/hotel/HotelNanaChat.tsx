"use client";

import { useEffect, useRef, useState } from "react";
import LinkedText from "@/components/LinkedText";

// Ordering by chatting with Nana on a Hotel Grand site (mockup 7; lib/hotel-nana-server.ts). The chat lives on the server, so this page
// sends only the new message and the chat's id (kept for this visit only).
type Msg = { role: "user" | "assistant"; text: string };
const KEY = "hotel-nana-chat";

export default function HotelNanaChat({ hotelId, name }: { hotelId: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const chatId = useRef<string | null>(null);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { try { chatId.current = sessionStorage.getItem(`${KEY}:${hotelId}`); } catch { /* private window */ } }, [hotelId]);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [msgs, open]);
  const send = async () => {
    const m = text.trim();
    if (!m || busy) return;
    setText(""); setBusy(true); setMsgs((x) => [...x, { role: "user", text: m }]);
    try {
      const r = await fetch("/api/public/hotel/nana", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ h: hotelId, chatId: chatId.current, message: m }) });
      const j = await r.json().catch(() => ({}));
      if (j.chatId) { chatId.current = j.chatId; try { sessionStorage.setItem(`${KEY}:${hotelId}`, j.chatId); } catch { /* fine */ } }
      setMsgs((x) => [...x, { role: "assistant", text: r.ok ? j.reply : j.error || "Sorry, I couldn't answer just now." }]);
    } catch { setMsgs((x) => [...x, { role: "assistant", text: "Sorry, I couldn't reach the hotel just now." }]); }
    setBusy(false);
  };
  if (!open) return <button onClick={() => setOpen(true)} className="fixed bottom-5 right-5 z-40 rounded-full bg-crimson px-5 py-3 font-ui text-sm font-bold text-paper shadow-lg">💬 Order by chat</button>;
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85vh] flex-col rounded-t-3xl border border-rule bg-paper shadow-2xl sm:inset-x-auto sm:bottom-5 sm:right-5 sm:w-96 sm:rounded-3xl" role="dialog" aria-label={`Chat with Nana at ${name}`}>
      <div className="flex items-center justify-between rounded-t-3xl px-4 py-3 text-paper" style={{ backgroundImage: "linear-gradient(90deg,#4E0119,#A6093D)" }}>
        <p className="font-ui text-sm font-bold">{name} · chat</p>
        <button onClick={() => setOpen(false)} aria-label="Close the chat" className="text-lg">×</button>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-4 text-sm" aria-live="polite">
        {msgs.length === 0 && <p className="rounded-2xl border border-rule bg-white p-3 text-slate">Hello! Tell me what you&apos;d like to eat or drink, or the dates you want a room. I speak English, Pidgin, Yorùbá, Igbo and Hausa.</p>}
        {msgs.map((m, i) => (
          <div key={i} className={m.role === "user" ? "ml-8 rounded-2xl border border-rule bg-white p-3" : "mr-8 rounded-2xl border border-[#f0cbd6] bg-gradient-to-br from-white to-[#fbeff3] p-3"}>
            {m.role === "assistant" && <p className="text-xs font-bold text-crimson">Nana</p>}
            <p className="whitespace-pre-line"><LinkedText text={m.text} /></p>
          </div>
        ))}
        {busy && <p className="mr-8 rounded-2xl bg-white p-3 text-slate">Nana is checking…</p>}
        <p className="rounded-xl border border-[#F1D48A] bg-[#FFF4D6] p-2.5 text-xs text-[#5a4300]">Prices, totals, rooms and account numbers always come from the hotel&apos;s own records, never from the AI.</p>
        <div ref={end} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex gap-2 border-t border-rule p-3">
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} placeholder="Type a message" aria-label="Message" className="flex-1 rounded-full border border-rule bg-white px-4 py-2 text-sm" />
        <button disabled={busy || !text.trim()} className="rounded-full bg-crimson px-4 font-ui text-sm font-bold text-paper disabled:opacity-50">Send</button>
      </form>
    </div>
  );
}
