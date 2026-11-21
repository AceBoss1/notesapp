import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PromoOffer from "@/components/promos/PromoOffer";
import { campaignByCode, campaignById } from "@/lib/promos";

// A promo campaign's page (lib/promos.ts): /offers/DAVIDO-at-34 (or /offers/davido-at-34). Claim a free plan while its slots last, pitch for
// a venture slot, and sign up for the campaign's Arcade tournament on the day.
type Props = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = campaignByCode(decodeURIComponent((await params).code)) ?? campaignById((await params).code);
  if (!c) return { title: "Offer not found · #NotesApp" };
  return {
    title: `${c.code}: free plans, venture slots and an Arcade tournament · #NotesApp`,
    description: `Use ${c.code} on #NotesApp: free Enterprise, Business and Pro plans while they last, venture slots with up to ₦5m support each, and the ${c.tournament?.name ?? "Arcade tournament"}.`,
  };
}

export default async function OfferPage({ params }: Props) {
  const raw = decodeURIComponent((await params).code);
  const c = campaignByCode(raw) ?? campaignById(raw);
  if (!c) notFound();
  return <PromoOffer code={c.code} />;
}
