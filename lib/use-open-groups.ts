"use client";

import { useCallback, useEffect, useState } from "react";
import { openState, parseSaved, type Saved } from "./menu-groups";

// Which menu groups are open (lib/menu-groups.ts). The first render uses only the current page, the same on the server and in the
// browser; the choices saved in this browser are read in an effect afterwards, so there's never a hydration mismatch.
const read = (key: string): Saved => {
  try { return parseSaved(window.localStorage.getItem(key)); } catch { return {}; }
};
const write = (key: string, v: Saved) => {
  try { window.localStorage.setItem(key, JSON.stringify(v)); } catch { /* private window or storage blocked: just not remembered */ }
};

export function useOpenGroups(storageKey: string, current: string | undefined) {
  const key = `naMenu:${storageKey}`;
  const [open, setOpen] = useState<Saved>(() => openState({}, current));
  useEffect(() => { setOpen(openState(read(key), current)); }, [key, current]);
  const toggle = useCallback((group: string) => {
    setOpen((o) => {
      const value = !o[group];
      write(key, { ...read(key), [group]: value });
      return { ...o, [group]: value };
    });
  }, [key]);
  return { isOpen: (group: string) => !!open[group], toggle };
}
