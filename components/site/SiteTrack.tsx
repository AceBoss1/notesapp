"use client";

import ParcelView from "@/components/ParcelView";
import { isCrimsonTheme } from "@/lib/site-themes";
import { useSite } from "./SiteContext";
import AuroraBand from "./AuroraBand";
import TrackBox from "./TrackBox";

// The Track page of a logistics business's site: look a parcel up, then follow it (only this business's shipments; lib/shipments.ts).
export function SiteTrackLookup() {
  const { displayName, theme } = useSite();
  const crimson = isCrimsonTheme(theme);
  return (
    <div>
      {crimson && <AuroraBand eyebrow={displayName}><h1 className="mt-3 font-display text-4xl sm:text-5xl">Track a parcel</h1></AuroraBand>}
      <div className={`mx-auto max-w-3xl px-4 sm:px-6 ${crimson ? "pb-16 pt-2" : "py-14"}`}>
        {!crimson && <><p className="eyebrow">{displayName}</p><h1 className="mt-2 font-display text-4xl text-ink">Track a parcel</h1></>}
        <TrackBox title="Where is my parcel?" className="card mt-8 p-6" />
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {[["Every hand-off is recorded", `Each rider or agent ${displayName} hands your parcel to is logged here as it happens.`], ["Call whoever has it", "Enter the last 4 digits of the receiver's phone number to see the rider's number."], ["Live, no app needed", "Keep this page: it updates at every step until your parcel is delivered."]].map(([h, t]) => (
            <div key={h} className="card p-5"><p className="font-ui text-sm font-bold text-ink">{h}</p><p className="mt-1 text-xs text-slate">{t}</p></div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SiteTrackParcel({ id }: { id: string }) {
  const { base, username, pages } = useSite();
  return <ParcelView id={id} site={{ base, username, contact: pages.contact }} />;
}
