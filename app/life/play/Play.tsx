"use client";
import dynamic from "next/dynamic";

const LifeGame = dynamic(() => import("@/components/life/LifeGame"), {
  ssr: false,
  loading: () => <div data-theme-off className="flex min-h-screen items-center justify-center bg-gradient-to-b from-sky-200 to-amber-50 font-ui text-ink"><p className="animate-pulse text-xl font-extrabold">Notes <span className="text-emerald-600">Life</span></p></div>,
});

export default function Play() {
  // The game has its own day and night, so it keeps its own colours whatever the app's Day or Night is.
  return <div data-theme-off><LifeGame /></div>;
}
