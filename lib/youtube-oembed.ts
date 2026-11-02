import { cleanVideoCredit, youtubeOembedUrl, type VideoCredit } from "./courses";

// Server-only. Who made a YouTube video, from YouTube's public oEmbed endpoint (no key needed): its title, the channel's name and
// the channel's address. Null when the video is private, removed or YouTube doesn't answer within a few seconds; the lesson is still
// saved then, keeping any credit it already had for the same video (lib/courses-server.ts withCredit).
export async function youtubeCredit(id: string, fetchImpl: typeof fetch = fetch): Promise<VideoCredit | null> {
  try {
    const r = await fetchImpl(youtubeOembedUrl(id), { signal: AbortSignal.timeout(4000), headers: { Accept: "application/json" } });
    if (!r.ok) return null;
    const j = (await r.json()) as Record<string, unknown>;
    return cleanVideoCredit({ title: j.title, name: j.author_name, url: j.author_url });
  } catch {
    return null;
  }
}
