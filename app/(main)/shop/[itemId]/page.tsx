import ShopItemView from "@/components/ShopItemView";

// Rendered on the first visit to each address, then served from Vercel's cache and refreshed in the background
// (see `revalidate`), instead of running a function on every view.
export const revalidate = 300;
export async function generateStaticParams() {
  return [];
}

export default function Page() {
  return <ShopItemView />;
}
