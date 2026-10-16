"use client";

import { useEffect, useState } from "react";
import { APP_URL, LIFE_URL, SITE_URL, familyHost } from "./host";

// The main site, the app or Notes Life on the domain the visitor is using (lib/host.ts: every domain serves the site under its
// own name). The first render uses the primary address, so server and browser match; it switches to the visitor's domain at once.
const PRIMARY = { main: SITE_URL, app: APP_URL, life: LIFE_URL } as const;
export function useFamilyUrl(role: "main" | "app" | "life"): string {
  const [url, setUrl] = useState<string>(PRIMARY[role]);
  useEffect(() => {
    setUrl(`${window.location.protocol}//${familyHost(window.location.host, role)}`);
  }, [role]);
  return url;
}
