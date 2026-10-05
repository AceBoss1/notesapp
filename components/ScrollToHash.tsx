"use client";

import { useEffect } from "react";

// Opens a page already scrolled to the section named in the URL (#book, #subscribe …), even though that section only
// appears once its data has loaded: it waits for the element to exist and have some height (up to 10 s), scrolls it into
// view and outlines it briefly. If the section never appears (say, the member doesn't offer it), nothing happens.
export default function ScrollToHash() {
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.replace(/^#/, ""));
    if (!id) return;
    const tryScroll = () => {
      const el = document.getElementById(id);
      if (!el || el.offsetHeight === 0) return false;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-crimson", "ring-offset-4", "transition-shadow");
      setTimeout(() => el.classList.remove("ring-2", "ring-crimson", "ring-offset-4"), 2500);
      return true;
    };
    if (tryScroll()) return;
    const obs = new MutationObserver(() => {
      if (tryScroll()) obs.disconnect();
    });
    obs.observe(document.body, { childList: true, subtree: true });
    const stop = setTimeout(() => obs.disconnect(), 10_000);
    return () => {
      obs.disconnect();
      clearTimeout(stop);
    };
  }, []);
  return null;
}
