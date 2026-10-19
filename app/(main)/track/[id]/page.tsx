"use client";

import { useParams } from "next/navigation";
import ParcelView from "@/components/ParcelView";

// A parcel's tracking page on #NotesApp: store orders, official merch and logistics businesses' shipments (components/ParcelView.tsx).
export default function TrackParcelPage() {
  const { id } = useParams<{ id: string }>();
  return <ParcelView id={id} />;
}
