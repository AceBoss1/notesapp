import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, where } from "firebase/firestore";
import { db } from "./firebase";
import { toMillis } from "./dates";

// Demo catalogue for today — one array per username, hardcoded rather
// than a Firestore read, so the store has real content in front of
// investors without waiting on a CMS UI for products. The `journals/
// {id}/store` subcollection in firestore.rules is where this moves
// once that UI exists.

export type StoreItem = {
  id?: string; // Firestore doc id — absent on the hardcoded founder catalogues
  title: string;
  subtitle?: string;
  price: string; // display string — "Free", "$8", "₦6,000", etc.
  badge?: string; // "Free" | "Best Seller" | "On Amazon" | "Magazine feature"
  link: string; // external checkout / read link
  image: string;
  cta: string; // button label
  // Physical goods sold on-platform (buyer pays through #NotesApp, money held until delivery).
  sellable?: boolean;
  priceKobo?: number;
  deliveryKobo?: number;
  stock?: number; // optional; counts down per sale (for an item with options: the total across all combinations)
  // Extra photos (the first is the main one, also kept in `image`): up to MAX_IMAGES.
  images?: string[];
  // Up to two options a buyer picks from (for example Size and Colour), each with up to five choices. Stock is then kept
  // per combination in `variantStock`, keyed like "XL|Red" (see variantKey).
  options?: StoreOption[];
  variantStock?: Record<string, number>;
  // "digital" = a file the buyer downloads after paying (no delivery, no stock, final once
  // downloaded); anything else is a physical item. The file itself lives in a private bucket
  // (storeFiles/{id}, server-only); only its name and size are public.
  kind?: "physical" | "digital";
  fileName?: string;
  fileSize?: number;
};

export type StoreOption = { name: string; choices: string[] };
export const MAX_IMAGES = 5;
export const MAX_OPTIONS = 2;
export const MAX_CHOICES = 5;

// One combination of choices ("XL", "Red") ↔ the key it's stored under ("XL|Red").
export const variantKey = (selection: string[]) => selection.join("|");

// Every combination the options allow, in order (Size S/M × Colour Red/Blue → S|Red, S|Blue, M|Red, M|Blue).
export function variantCombos(options: StoreOption[] = []): string[][] {
  return options.reduce<string[][]>((acc, o) => acc.flatMap((a) => o.choices.map((c) => [...a, c])), [[]]).filter((c) => c.length === options.length && options.length > 0);
}

// "Size: XL, Colour: Red" for a stored key.
export const variantLabel = (options: StoreOption[], key: string) => key.split("|").map((c, i) => `${options[i]?.name ?? "Option"}: ${c}`).join(", ");

// Trims, drops blanks and repeats, and enforces the limits. A choice may not contain "|" (it separates choices in a key).
export function cleanOptions(options: StoreOption[] | undefined): StoreOption[] {
  return (options ?? [])
    .map((o) => ({
      name: o.name.replace(/\|/g, " ").trim().slice(0, 20),
      choices: [...new Set(o.choices.map((c) => c.replace(/\|/g, " ").trim().slice(0, 24)).filter(Boolean))].slice(0, MAX_CHOICES),
    }))
    .filter((o) => o.name && o.choices.length > 0)
    .slice(0, MAX_OPTIONS);
}

export const isDigital = (i: Pick<StoreItem, "kind">) => i.kind === "digital";

export const STORE_ITEMS: Record<string, StoreItem[]> = {
  // Sold via Selar, same as precheks.com.ng/shop — Chimdinma's existing
  // catalogue, carried over so the store isn't empty on day one.
  chimdinma: [
    {
      title: "MS-Excel — Beginner to Advanced Proficiency",
      subtitle:
        "A physical course from complete beginner to advanced Excel proficiency — formulas, pivot tables, dashboards, and real business applications.",
      price: "$29.49",
      badge: "Best Seller",
      link: "https://selar.com/89u90q",
      image: "/images/shop/ms-excel-beginner-to-advanced.jpg",
      cta: "Buy on Selar",
    },
    {
      title: "Career Planning and Development",
      subtitle:
        "A practical downloadable resource for professionals at any stage — goal-setting, skill mapping, and building a career you're proud of.",
      price: "$8",
      link: "https://selar.com/208003",
      image: "/images/shop/career-planning-and-development.jpg",
      cta: "Buy on Selar",
    },
    {
      title: "20 IT Niches to Explore (With or Without a Degree)",
      subtitle:
        "A free downloadable guide mapping out 20 career-ready IT niches you can enter regardless of academic background.",
      price: "Free",
      badge: "Free",
      link: "https://selar.com/78101t",
      image: "/images/shop/20-it-niches-to-be-explored.jpg",
      cta: "Download Free",
    },
  ],

  emmanuel: [
    {
      title: "From Survival To Strategy",
      subtitle: "The Hidden Structures That Prevent Growth — featured in LWB Magazine, June 2026.",
      price: "Free",
      badge: "Magazine feature",
      link: "https://lwbmag.name.ng/june-2026.html",
      image: "/images/shop/Hero-Cover-June-2026.webp",
      cta: "Read the feature",
    },
    {
      title: "The Future of Digital Money",
      subtitle: "Cryptocurrency in 2023 and Beyond.",
      price: "$9.99",
      badge: "Amazon",
      link: "https://www.amazon.com/Future-Digital-Money-Cryptocurrency-Beyond-ebook/dp/B0CK2TRWM6?ref_=ast_author_dp&th=1&psc=1",
      image: "/images/shop/Future-Digital-Money-Cryptocurrency.jpg",
      cta: "Buy on Amazon",
    },
    {
      title: "Entrepreneurship 101",
      subtitle: "Release The Inner Entrepreneur In You!",
      price: "$6.99",
      badge: "Amazon",
      link: "https://www.amazon.com/Entrepreneurship-101-Release-Inner-Entrepreneur-ebook/dp/B0BTTWHC5V?ref_=ast_author_dp&th=1&psc=1",
      image: "/images/shop/Entrepreneurship-101-Release-Inner-Entrepreneur.jpg",
      cta: "Buy on Amazon",
    },
  ],
};


// ---- Publisher-managed items (Firestore `storeItems`) -------------------
// Anyone who can publish manages their own shelf; the founders' catalogues
// above are shown first and can't be edited in the UI.

export type StoreItemInput = Omit<StoreItem, "id">;

export const DEFAULT_STORE_IMAGE = "/images/brand/store-placeholder.svg";

export async function getStoreItems(uid: string | undefined, username: string): Promise<StoreItem[]> {
  const fixed = STORE_ITEMS[username] ?? [];
  if (!uid || uid.startsWith("admin:")) return fixed;
  try {
    const snap = await getDocs(query(collection(db, "storeItems"), where("ownerUid", "==", uid)));
    const own = snap.docs
      .map((d) => ({ id: d.id, createdAt: d.data().createdAt as string | undefined, ...(d.data() as StoreItemInput) }))
      .sort((a, b) => toMillis(a.createdAt) - toMillis(b.createdAt));
    return [...fixed, ...own];
  } catch {
    return fixed;
  }
}

// Every publisher listing is a physical item sold through #NotesApp checkout: a price, a
// delivery fee and a managed stock count (no link-outs — the founders' own catalogues above
// are the only exception). Legacy link-out listings can no longer be saved, only removed.
function clean(input: StoreItemInput) {
  const digital = input.kind === "digital";
  const images = [...new Set((input.images ?? []).map((u) => u.trim()).filter(Boolean))].slice(0, MAX_IMAGES);
  const options = digital ? [] : cleanOptions(input.options);
  const combos = variantCombos(options).map(variantKey);
  const variantStock = Object.fromEntries(combos.map((k) => [k, Math.max(0, Math.floor(Number(input.variantStock?.[k] ?? 0)))]));
  const stock = digital ? 0 : options.length ? combos.reduce((n, k) => n + variantStock[k], 0) : Math.max(0, Math.floor(Number(input.stock ?? 0)));
  return {
    sellable: true as const,
    ...(digital ? { kind: "digital" as const, ...(input.fileName ? { fileName: input.fileName, fileSize: input.fileSize ?? 0 } : {}) } : {}),
    priceKobo: Math.round(Number(input.priceKobo)),
    deliveryKobo: digital ? 0 : Math.round(Number(input.deliveryKobo ?? 0)),
    stock,
    ...(options.length ? { options, variantStock } : {}),
    ...(images.length ? { images } : {}),
    title: input.title.trim(),
    ...(input.subtitle?.trim() ? { subtitle: input.subtitle.trim() } : {}),
    price: input.price.trim(),
    ...(input.badge?.trim() ? { badge: input.badge.trim() } : {}),
    link: "https://www.notesapp.name.ng",
    image: images[0] || input.image.trim() || DEFAULT_STORE_IMAGE,
    cta: digital ? "Buy & download" : "Buy now",
  };
}

export async function addStoreItem(uid: string, input: StoreItemInput): Promise<string> {
  const now = new Date().toISOString();
  const ref = await addDoc(collection(db, "storeItems"), { ownerUid: uid, ...clean(input), createdAt: now, updatedAt: now });
  return ref.id;
}

// `stockChanged` is true only when the seller edited the stock field. Otherwise the
// stock currently in the database wins: orders reserve and release stock on the server,
// and writing back a stale number from the form would undo them.
export async function updateStoreItem(uid: string, id: string, input: StoreItemInput, stockChanged = false): Promise<void> {
  const ref = doc(db, "storeItems", id);
  // Replace the whole listing so cleared optional fields actually disappear.
  const existing = await getDoc(ref);
  // A listing keeps its kind, and a digital one its attached file (set by the server).
  const keepKind = existing.data()?.kind === "digital" ? "digital" : undefined;
  const data = clean({ ...input, kind: keepKind, ...(keepKind ? { fileName: existing.data()?.fileName, fileSize: existing.data()?.fileSize } : {}) });
  await setDoc(ref, {
    ...data,
    // Unless the seller edited stock (or the options), the numbers in the database win: orders reserve and release them.
    ...(!stockChanged && Number.isInteger(existing.data()?.stock) ? { stock: existing.data()!.stock } : {}),
    ...(!stockChanged && existing.data()?.variantStock && data.options ? { variantStock: existing.data()!.variantStock } : {}),
    ownerUid: existing.data()?.ownerUid ?? uid,
    createdAt: existing.data()?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

export async function deleteStoreItem(id: string): Promise<void> {
  await deleteDoc(doc(db, "storeItems", id));
}
