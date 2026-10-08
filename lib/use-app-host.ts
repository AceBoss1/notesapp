"use client";

import { useEffect, useState } from "react";
import { isAppHost } from "@/lib/host";

// True on the app domain (notesapp.ng). Decided in an effect so server and browser render the same first.
export function useIsAppHost(): boolean {
  const [app, setApp] = useState(false);
  useEffect(() => setApp(isAppHost(window.location.hostname)), []);
  return app;
}
