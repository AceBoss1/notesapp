import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { AD_IMAGE, BILLBOARD_IMAGE } from "@/lib/ad-config";

export const runtime = "nodejs";

// The PNG templates linked from /advertise/specifications: the advert (1200 × 628) or, with ?kind=billboard, the Notes Life
// billboard (1600 × 900), with the safe area marked. Open it in any editor, design over it, and hide the guide layer.
export async function GET(req: NextRequest) {
  const billboard = req.nextUrl.searchParams.get("kind") === "billboard";
  const spec = billboard ? BILLBOARD_IMAGE : AD_IMAGE;
  const { width: W, height: H } = spec, { width: sw, height: sh } = spec.safe;
  const res = new ImageResponse(
    (
      <div style={{ display: "flex", width: W, height: H, background: "#EFE6DE", position: "relative", alignItems: "center", justifyContent: "center", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", position: "absolute", left: (W - sw) / 2, top: (H - sh) / 2, width: sw, height: sh, border: "4px dashed #7A0328" }} />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", color: "#7A0328" }}>
          <div style={{ display: "flex", fontSize: billboard ? 64 : 52, fontWeight: 700 }}>{`${W} × ${H} px`}</div>
          <div style={{ display: "flex", fontSize: billboard ? 34 : 28, marginTop: 14, color: "#5B5450" }}>{`Keep the logo, words and faces inside the dashed box (${sw} × ${sh})`}</div>
          <div style={{ display: "flex", fontSize: billboard ? 28 : 24, marginTop: 10, color: "#5B5450" }}>{billboard ? "#NotesApp · Notes Life billboard" : "#NotesApp · advert picture · under 500 KB"}</div>
        </div>
      </div>
    ),
    { width: W, height: H }
  );
  res.headers.set("Content-Disposition", `attachment; filename="notesapp-${billboard ? "billboard" : "advert"}-template-${W}x${H}.png"`);
  res.headers.set("Cache-Control", "public, max-age=86400");
  return res;
}
