import { NextRequest, NextResponse } from "next/server";
import { friendlyMessage } from "./api-errors";
import { ApiAuth, ApiScope, apiError, authenticateApiKey } from "./api-keys";

export const SITE_URL = () => (process.env.NEXT_PUBLIC_SITE_URL || "https://www.notesapp.name.ng").replace(/\/$/, "");

type Ctx = { params: Record<string, string> };
type Handler = (req: NextRequest, auth: ApiAuth, ctx: Ctx) => Promise<NextResponse>;

// Wraps a /api/v1 route: key + scope + rate-limit check, then consistent JSON errors.
export function v1(scope: ApiScope | "any", handler: Handler) {
  return async (req: NextRequest, ctx: Ctx): Promise<NextResponse> => {
    const a = await authenticateApiKey(req, scope);
    if ("fail" in a) return a.fail;
    try {
      const res = await handler(req, a.auth, ctx);
      res.headers.set("Cache-Control", "no-store");
      return res;
    } catch (err) {
      if (err instanceof ApiFail) return apiError(err.e);
      console.error("api v1 failed", req.nextUrl.pathname, err);
      const f = friendlyMessage(err, "Something went wrong");
      return apiError({ status: f.status >= 400 && f.status < 600 ? f.status : 500, code: "server_error", message: f.message });
    }
  };
}

export class ApiFail extends Error {
  constructor(public e: { status: number; code: string; message: string }) { super(e.message); }
}
export const fail = (status: number, code: string, message: string) => new ApiFail({ status, code, message });

// ?limit (1–100, default 25) and ?cursor (the last id of the previous page) over an already-sorted list.
export function paginate<T extends { id: string }>(req: NextRequest, rows: T[]): { data: T[]; next_cursor: string | null } {
  const limit = Math.min(100, Math.max(1, Number(req.nextUrl.searchParams.get("limit")) || 25));
  const cursor = req.nextUrl.searchParams.get("cursor");
  const start = cursor ? rows.findIndex((r) => r.id === cursor) + 1 : 0;
  const data = rows.slice(start, start + limit);
  return { data, next_cursor: start + limit < rows.length && data.length ? data[data.length - 1].id : null };
}

export const byNewest = (field: string) => (a: Record<string, any>, b: Record<string, any>) =>
  new Date(b[field] || 0).getTime() - new Date(a[field] || 0).getTime();

export function postJson(id: string, n: Record<string, any>, withContent = false) {
  return {
    id, slug: n.slug, url: `${SITE_URL()}/journals/${n.slug}`, title: n.title, status: n.status, date: n.date,
    tags: n.tags ?? [], categories: n.categories ?? [], featured_image: n.featured_image || "", premium: !!n.premium,
    view_count: n.viewCount ?? 0, like_count: n.likeCount ?? 0, share_count: n.shareCount ?? 0,
    ...(withContent ? { content: n.content ?? "" } : {}),
  };
}

export type Row = Record<string, any> & { id: string };
export const rowsOf = (snap: FirebaseFirestore.QuerySnapshot): Row[] => snap.docs.map((d) => ({ ...(d.data() as Record<string, any>), id: d.id }));

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const list = (v: unknown, max: number, n: number) => (Array.isArray(v) ? v.map((x) => str(x, max)).filter(Boolean).slice(0, n) : []);

export function parsePostBody(b: Record<string, unknown>, partial: boolean) {
  const out: Record<string, unknown> = {};
  if (!partial || b.title !== undefined) {
    const t = str(b.title, 140);
    if (!t) throw fail(400, "invalid_request", "`title` is required (up to 140 characters).");
    out.title = t;
  }
  if (!partial || b.content !== undefined) {
    const c = typeof b.content === "string" ? b.content.trim() : "";
    if (!c) throw fail(400, "invalid_request", "`content` (Markdown) is required.");
    if (c.length > 100_000) throw fail(400, "invalid_request", "`content` is limited to 100,000 characters.");
    out.content = c;
  }
  if (b.status !== undefined) {
    if (b.status !== "draft" && b.status !== "published") throw fail(400, "invalid_request", "`status` must be `draft` or `published`.");
    out.status = b.status;
  }
  if (b.tags !== undefined) out.tags = list(b.tags, 40, 10);
  if (b.categories !== undefined) out.categories = list(b.categories, 40, 5);
  if (b.premium !== undefined) out.premium = b.premium === true;
  if (b.featured_image !== undefined) {
    const u = str(b.featured_image, 500);
    if (u && !/^https:\/\//.test(u)) throw fail(400, "invalid_request", "`featured_image` must be an https URL.");
    out.featured_image = u;
  }
  return out;
}

