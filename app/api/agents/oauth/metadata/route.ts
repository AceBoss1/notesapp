import { NextRequest } from "next/server";
import { oauthJson, preflight, resourceMetadata, serverMetadata } from "@/lib/agents/oauth-http";

export const dynamic = "force-dynamic";
// /.well-known/oauth-authorization-server and /.well-known/oauth-protected-resource (middleware.ts rewrites them here, on every host):
// how an assistant finds the Connect NotesApp screen and the token endpoint for the domain it called.
export async function GET(req: NextRequest) {
  return oauthJson(req.nextUrl.searchParams.get("kind") === "resource" ? resourceMetadata(req) : serverMetadata(req));
}
export const OPTIONS = preflight;
