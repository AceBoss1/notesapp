"use client";

import { useIsAppHost } from "@/lib/use-app-host";

// The marketing footer isn't shown on the app domain.
export default function HideOnAppHost({ children }: { children: React.ReactNode }) {
  return useIsAppHost() ? null : <>{children}</>;
}
