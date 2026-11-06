"use client";

import { useEffect, useState } from "react";
import { SONG, SONGS, type Song } from "./songs";

// Every song anyone may use (house songs and approved artist songs), fetched once a visit. House songs are there at once, so pickers and
// players never wait on the network for them.
let cache: Promise<Song[]> | null = null;
let known: Song[] = SONGS;
export function loadSongs(): Promise<Song[]> {
  if (!cache) cache = fetch("/api/sounds").then((r) => (r.ok ? r.json() : { songs: SONGS })).then((j: { songs?: Song[] }) => { known = j.songs?.length ? j.songs : SONGS; return known; }).catch(() => { cache = null; return SONGS; });
  return cache;
}
export function useSongs(): Song[] {
  const [songs, setSongs] = useState<Song[]>(known);
  useEffect(() => { let on = true; void loadSongs().then((s) => { if (on) setSongs(s); }); return () => { on = false; }; }, []);
  return songs;
}
// One song by id (a house song at once; an artist song once the list is in).
export function useSong(id: string | undefined): Song | undefined {
  const songs = useSongs();
  return id ? SONG(id) ?? songs.find((s) => s.id === id) : undefined;
}
