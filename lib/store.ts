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
};

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

function clean(input: StoreItemInput) {
  return {
    title: input.title.trim(),
    ...(input.subtitle?.trim() ? { subtitle: input.subtitle.trim() } : {}),
    price: input.price.trim(),
    ...(input.badge?.trim() ? { badge: input.badge.trim() } : {}),
    link: input.link.trim(),
    image: input.image.trim() || DEFAULT_STORE_IMAGE,
    cta: input.cta.trim() || "View",
  };
}

export async function addStoreItem(uid: string, input: StoreItemInput): Promise<void> {
  const now = new Date().toISOString();
  await addDoc(collection(db, "storeItems"), { ownerUid: uid, ...clean(input), createdAt: now, updatedAt: now });
}

export async function updateStoreItem(uid: string, id: string, input: StoreItemInput): Promise<void> {
  const ref = doc(db, "storeItems", id);
  // Replace the whole listing so cleared optional fields actually disappear.
  const existing = await getDoc(ref);
  await setDoc(ref, {
    ownerUid: uid,
    ...clean(input),
    createdAt: existing.data()?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

export async function deleteStoreItem(id: string): Promise<void> {
  await deleteDoc(doc(db, "storeItems", id));
}
