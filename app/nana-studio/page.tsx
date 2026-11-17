import { headers } from "next/headers";
import PortraitStudio from "@/components/nana/PortraitStudio";
import { isNanaHost, mainSiteUrl } from "@/lib/host";

// nana.<domain>/ (middleware.ts rewrites it here): the portrait studio. lib/nana-portrait.ts.
export default function Page() {
  const host = headers().get("host") || "";
  return <PortraitStudio base={isNanaHost(host) ? "" : "/nana-studio"} pricingUrl={mainSiteUrl(host, "/pricing")} />;
}
