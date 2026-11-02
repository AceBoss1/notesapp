"use client";

import { useEffect, useState } from "react";
import { DEFAULT_ROOM_FIGURES, type RoomFigures } from "@/lib/rooms";

// How many a new audio room holds (an admin setting, lib/rooms.ts), read from the public /api/limits; the defaults until it answers.
export function useRoomFigures(): RoomFigures {
  const [f, setF] = useState<RoomFigures>(DEFAULT_ROOM_FIGURES);
  useEffect(() => {
    let on = true;
    fetch("/api/limits", { cache: "no-store" }).then((r) => r.json()).then((j) => { if (on && j?.rooms?.listeners) setF(j.rooms as RoomFigures); }).catch(() => {});
    return () => { on = false; };
  }, []);
  return f;
}
