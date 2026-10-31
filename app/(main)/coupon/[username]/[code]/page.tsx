import type { Metadata } from "next";
import CouponView from "@/components/CouponView";

// A publisher's coupon, shared as a link (lib/discounts.ts couponPath): its card, Save to my coupons, and Shop now.
export const revalidate = 300;
export async function generateStaticParams() {
  return [];
}

export function generateMetadata({ params }: { params: { username: string; code: string } }): Metadata {
  const seller = decodeURIComponent(params.username).toLowerCase(), code = decodeURIComponent(params.code).toUpperCase();
  const image = `/api/coupons/card?seller=${encodeURIComponent(seller)}&code=${encodeURIComponent(code)}`;
  const title = `Coupon ${code} from @${seller}`;
  const description = `Use ${code} at checkout on @${seller}'s shop on #NotesApp.`;
  return { title, description, openGraph: { title, description, images: [{ url: image, width: 1200, height: 630, alt: title }] }, twitter: { card: "summary_large_image", title, description, images: [image] } };
}

export default function CouponPage({ params }: { params: { username: string; code: string } }) {
  return <CouponView seller={decodeURIComponent(params.username).toLowerCase()} code={decodeURIComponent(params.code).toUpperCase()} />;
}
