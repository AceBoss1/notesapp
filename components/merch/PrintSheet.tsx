"use client";

import { useMemo } from "react";
import { MERCH_COLOURS, choiceText, getMerchDesign, printKey, type MerchOrder, type MerchSettings } from "@/lib/merch";

// Admin → Merch: what to print for the batch (docs/MERCH_3D.md). Paid, unprinted orders of the batch grouped the way the printer works:
// one row per identical piece (item, colour, logo, print place, size, name), with a picture, a download for the printer and
// "Mark all printed".
export type PrintRow = { key: string; item: string; picture: string; swatch?: string; text: string; size: string; name: string; count: number; refs: string[] };

export function printRows(orders: MerchOrder[], batchId: string): PrintRow[] {
  const m = new Map<string, PrintRow>();
  for (const o of orders) {
    if (o.status !== "preordered" || o.batchId !== batchId) continue;
    const k = printKey(o);
    const design = o.designId ? getMerchDesign(o.designId) : undefined;
    const row = m.get(k) ?? {
      key: k, item: o.itemName, picture: design?.image ?? "", swatch: MERCH_COLOURS.find((c) => c.id === o.colour)?.hex,
      text: choiceText({ colourName: o.colourName, logoLabel: o.designId ? undefined : o.logoLabel, place: o.place }), size: o.size ?? "", name: o.backName ?? "", count: 0, refs: [],
    };
    row.count += o.quantity; row.refs.push(o.reference);
    m.set(k, row);
  }
  return [...m.values()].sort((a, b) => a.key.localeCompare(b.key));
}

const csvCell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
export function printCsv(rows: PrintRow[]): string {
  return [["Item", "Colour, logo and place", "Size", "Name on the back", "How many", "Orders"], ...rows.map((r) => [r.item, r.text, r.size, r.name, r.count, r.refs.join(" ")])]
    .map((r) => r.map(csvCell).join(",")).join("\n");
}

export default function PrintSheet({ orders, merch, busy, onMarkAll }: { orders: MerchOrder[]; merch: MerchSettings; busy: boolean; onMarkAll: (refs: string[]) => void }) {
  const rows = useMemo(() => printRows(orders, merch.batch.id), [orders, merch.batch.id]);
  const pieces = rows.reduce((n, r) => n + r.count, 0), refs = rows.flatMap((r) => r.refs);
  function download() {
    const url = URL.createObjectURL(new Blob([printCsv(rows)], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = `notesapp-merch-${merch.batch.id}.csv`; a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <div className="card mt-8 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-ui text-sm font-bold">{merch.batch.label}: what to print</p>
        <p className="text-xs text-slate">{pieces} piece{pieces === 1 ? "" : "s"} in {refs.length} order{refs.length === 1 ? "" : "s"}, paid and not printed</p>
      </div>
      {rows.length === 0 ? <p className="mt-2 text-sm text-slate">Nothing waiting.</p> : (
        <>
          <table className="mt-3 w-full text-sm">
            <thead><tr className="text-left text-xs text-slate"><th className="py-1 font-normal">Item</th><th className="font-normal">Colour, logo and place</th><th className="font-normal">Size</th><th className="font-normal">Name</th><th className="text-right font-normal">How many</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="border-t border-rule">
                  <td className="py-1.5">
                    <span className="flex items-center gap-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {r.picture ? <img src={r.picture} alt="" className="h-8 w-8 object-contain" /> : <i className="block h-4 w-4 rounded border border-rule" style={{ background: r.swatch ?? "#fff" }} />}
                      <b>{r.item}</b>
                    </span>
                  </td>
                  <td>{r.text || "—"}</td><td>{r.size || "—"}</td><td className="font-mono">{r.name || "—"}</td><td className="text-right font-mono font-bold">×{r.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={download} className="btn-primary !px-4 !py-2 text-xs">Download for the printer</button>
            <button type="button" disabled={busy} onClick={() => { if (confirm(`Mark all ${refs.length} orders printed? Each buyer's tracking page will say Printed.`)) onMarkAll(refs); }} className="rounded-full border border-crimson px-4 py-2 text-xs font-semibold text-crimson disabled:opacity-40">{busy ? "Marking…" : "Mark all printed"}</button>
          </div>
          <p className="mt-2 text-xs text-slate">The download lists each piece once with how many to print and the order references. Custom shirts print from the design file; names go on the back in capitals.</p>
        </>
      )}
    </div>
  );
}
