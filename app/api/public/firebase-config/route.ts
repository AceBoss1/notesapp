import { NextResponse } from "next/server";
import { setting } from "@/lib/config";

export const dynamic = "force-dynamic";

// Firebase client configuration is public by design. Never include service-account or other server credentials here.
export async function GET() {
  const config = {
    apiKey: setting("NEXT_PUBLIC_FIREBASE_API_KEY"),
    authDomain: setting("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"),
    projectId: setting("NEXT_PUBLIC_FIREBASE_PROJECT_ID"),
    storageBucket: setting("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"),
    messagingSenderId: setting("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"),
    appId: setting("NEXT_PUBLIC_FIREBASE_APP_ID"),
  };

  if (!config.apiKey || !config.authDomain || !config.projectId || !config.appId) {
    return NextResponse.json({ error: "NotesApp sign-in is temporarily unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }

  return NextResponse.json(config, { headers: { "Cache-Control": "no-store" } });
}
