"use client";

import { useCallback, useEffect, useState } from "react";
import { STORE_MAX_QTY } from "./orders";
import { CART_MAX_LINES, lineKey, type CartLine } from "./cart";

// The basket in the browser (lib/cart.ts): one per shop, kept on this device (it survives a refresh, not a change of phone). What it
// shows (title, price, picture) is a copy for display only; the checkout prices everything again from the listings.
export type BasketLine = CartLine & { title: string; price: string; priceKobo: number; image: string; variantLabel?: string };
const KEY = (sellerUid: string) => `na-basket:${sellerUid}`;
const EVENT = "na-basket";

function read(sellerUid: string): BasketLine[] {
  try { const v = JSON.parse(localStorage.getItem(KEY(sellerUid)) || "[]"); return Array.isArray(v) ? v : []; } catch { return []; }
}
function write(sellerUid: string, lines: BasketLine[]) {
  try { if (lines.length) localStorage.setItem(KEY(sellerUid), JSON.stringify(lines)); else localStorage.removeItem(KEY(sellerUid)); } catch { /* private mode: the basket lasts this page */ }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { sellerUid, lines } }));
}

export function useBasket(sellerUid: string) {
  const [lines, setLines] = useState<BasketLine[]>([]);
  useEffect(() => {
    setLines(read(sellerUid));
    const on = (e: Event) => { const d = (e as CustomEvent).detail; if (d?.sellerUid === sellerUid) setLines(d.lines); };
    const onStorage = (e: StorageEvent) => { if (e.key === KEY(sellerUid)) setLines(read(sellerUid)); }; // another tab
    window.addEventListener(EVENT, on); window.addEventListener("storage", onStorage);
    return () => { window.removeEventListener(EVENT, on); window.removeEventListener("storage", onStorage); };
  }, [sellerUid]);
  // Adds to the line with the same item and options; false when the basket is full.
  const add = useCallback((line: BasketLine): boolean => {
    const cur = read(sellerUid);
    const same = cur.find((l) => lineKey(l) === lineKey(line));
    if (same) same.quantity = Math.min(STORE_MAX_QTY, same.quantity + line.quantity);
    else if (cur.length >= CART_MAX_LINES) return false;
    else cur.push({ ...line, quantity: Math.min(STORE_MAX_QTY, line.quantity) });
    write(sellerUid, cur);
    return true;
  }, [sellerUid]);
  const setQuantity = useCallback((key: string, quantity: number) => {
    write(sellerUid, read(sellerUid).map((l) => (lineKey(l) === key ? { ...l, quantity: Math.max(1, Math.min(STORE_MAX_QTY, quantity)) } : l)));
  }, [sellerUid]);
  const remove = useCallback((key: string) => write(sellerUid, read(sellerUid).filter((l) => lineKey(l) !== key)), [sellerUid]);
  const clear = useCallback(() => write(sellerUid, []), [sellerUid]);
  const count = lines.reduce((n, l) => n + l.quantity, 0);
  const subtotalKobo = lines.reduce((n, l) => n + l.priceKobo * l.quantity, 0);
  return { lines, add, setQuantity, remove, clear, count, subtotalKobo };
}
