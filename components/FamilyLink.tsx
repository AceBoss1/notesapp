"use client";

import type { AnchorHTMLAttributes, ReactNode } from "react";
import { useFamilyUrl } from "@/lib/use-family-url";

// A link to the main site, the app or Notes Life that stays on the visitor's domain (lib/use-family-url.ts).
export default function FamilyLink({ to, path = "", children, ...rest }: { to: "main" | "app" | "life"; path?: string; children: ReactNode } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href">) {
  const base = useFamilyUrl(to);
  return <a href={`${base}${path}`} {...rest}>{children}</a>;
}
