"use client";

import { useEffect, useState } from "react";
import { getStoreItems, StoreItem } from "@/lib/store";
import { useSite } from "./SiteContext";

// The member's items that can actually be bought (undefined while loading).
export function useOwnItems(): StoreItem[] | undefined {
  const { uid, username } = useSite();
  const [items, setItems] = useState<StoreItem[] | undefined>(undefined);
  useEffect(() => {
    getStoreItems(uid, username)
      .then((all) => setItems(all.filter((i) => i.sellable && i.id && (i.kind === "digital" ? !!i.fileName : true))))
      .catch(() => setItems([]));
  }, [uid, username]);
  return items;
}
