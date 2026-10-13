"use client";

import { useEffect, useState } from "react";
import { detectDevice, type Device } from "@/lib/visitor-device";

// The visitor's device, system and browser. null until the browser has been asked (so server and browser render the same first).
export function useDevice(): Device | null {
  const [d, setD] = useState<Device | null>(null);
  useEffect(() => {
    const nav = navigator as Navigator & { brave?: unknown };
    setD(detectDevice(navigator.userAgent, navigator.platform, navigator.maxTouchPoints, !!nav.brave));
  }, []);
  return d;
}
