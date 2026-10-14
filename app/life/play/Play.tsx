"use client";
import dynamic from "next/dynamic";

const LifeGame = dynamic(() => import("@/components/life/LifeGame"), {
  ssr: false,
  loading: () => <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-sky-200 to-amber-50 font-ui text-ink"><p className="animate-pulse text-xl font-extrabold">Notes <span className="text-emerald-600">Life</span></p></div>,
});

export default function Play() {
  return <LifeGame />;
}
