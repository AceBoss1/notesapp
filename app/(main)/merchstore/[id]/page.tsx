import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadLivePricing } from "@/lib/pricing-server";
import { currentMerch, getMerchDesign, getMerchItem, merchBatchState } from "@/lib/merch";
import MerchBuilder from "@/components/merch/MerchBuilder";

// One merch item or custom shirt, in 3D (docs/MERCH_3D.md). Prices and the batch come from Admin → Merch, refreshed every minute.
export const revalidate = 60;
type Props = { params: { id: string } };
const productOf = (id: string) => (getMerchItem(id) ? `item:${id}` : getMerchDesign(id) ? `design:${id}` : null);

export function generateMetadata({ params }: Props): Metadata {
  const item = getMerchItem(params.id), design = getMerchDesign(params.id);
  const name = design ? `Custom shirt: ${design.name}` : item?.name ?? "Merch";
  return { title: `${name} · Merch Store`, description: `Official #NotesApp merch: turn the ${name.toLowerCase()} all the way round, choose how you want it, and see the price as you go.` };
}

export default async function MerchItemPage({ params }: Props) {
  const product = productOf(params.id);
  if (!product) notFound();
  await loadLivePricing();
  const settings = currentMerch();
  const offer = product.startsWith("item:") ? settings.items.find((i) => i.id === params.id) : settings.designs.find((d) => d.id === params.id);
  if (!offer?.on) notFound();
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <Link href="/merchstore" className="text-sm text-crimson underline">← All merch</Link>
      <div className="mt-4"><MerchBuilder product={product} settings={settings} state={merchBatchState()} /></div>
    </div>
  );
}
