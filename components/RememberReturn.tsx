"use client";

import { useEffect } from "react";
import { rememberReturnHost } from "@/lib/return-to";

// Mounted once in the main layout: notes the member domain a visitor came from (?from=<host>) so a later payment can send them back.
export default function RememberReturn() {
  useEffect(() => {
    rememberReturnHost();
  }, []);
  return null;
}
