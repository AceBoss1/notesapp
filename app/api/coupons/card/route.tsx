import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { couponCard } from "@/lib/discounts-server";
import { TARGET_LABEL, naira } from "@/lib/discounts";

export const runtime = "nodejs";

// A coupon's card as a picture (1200 × 630): the link preview on WhatsApp, X and Facebook, and what "Download card" saves.
// GET ?seller=<username>&code=<CODE>. An ended coupon still draws, saying it has ended.
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const seller = String(q.get("seller") ?? "").toLowerCase(), code = String(q.get("code") ?? "").toUpperCase().slice(0, 40);
  const c = await couponCard(getAdminDb(), seller, code).catch(() => null);
  const what = c ? c.targets.map((t) => TARGET_LABEL[t]).join(" · ") : "";
  const small = c ? [c.minOrderKobo ? `On orders of ${naira(c.minOrderKobo)} or more` : "", c.firstOrderOnly ? "First order only" : "",
    c.endsAt ? `Ends ${new Date(c.endsAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}` : ""].filter(Boolean).join(" · ") : "";
  const res = new ImageResponse(
    (
      <div style={{ display: "flex", width: 1200, height: 630, background: "#7A0328", padding: 48, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", flex: 1, background: "#FBF7F2", borderRadius: 36, border: "6px dashed #C9A15B", padding: "56px 64px", flexDirection: "column", justifyContent: "space-between" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", fontSize: 34, color: "#5B5450" }}>{`@${seller} · on #NotesApp`}</div>
            <div style={{ display: "flex", fontSize: 30, fontWeight: 700, color: "#FBF7F2", background: "#7A0328", borderRadius: 999, padding: "10px 28px" }}>COUPON</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 96, fontWeight: 800, color: "#7A0328" }}>{c ? c.label : "This coupon has ended"}</div>
            {c && <div style={{ display: "flex", fontSize: 34, color: "#2A2421", marginTop: 8 }}>{what}</div>}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div style={{ display: "flex", fontSize: 72, fontWeight: 800, letterSpacing: 6, color: "#2A2421", border: "4px solid #2A2421", borderRadius: 18, padding: "6px 30px" }}>{code}</div>
            <div style={{ display: "flex", fontSize: 26, color: "#5B5450", maxWidth: 520, textAlign: "right" }}>{small}</div>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
  res.headers.set("Cache-Control", "public, max-age=300");
  return res;
}
