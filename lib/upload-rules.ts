// Shared by the presign route (server) and the uploader (browser).
export const ALLOWED_TYPES: Record<string, "image" | "video"> = {
  "image/jpeg": "image",
  "image/png": "image",
  "image/webp": "image",
  "image/gif": "image",
  "image/avif": "image",
  "video/mp4": "video",
  "video/webm": "video",
  "video/quicktime": "video",
};

export function maxUploadBytes(kind: "image" | "video", isAvatar: boolean): number {
  if (isAvatar) return 5 * 1024 * 1024;
  return kind === "image" ? 10 * 1024 * 1024 : 200 * 1024 * 1024;
}

// Confirms the file's leading bytes match a real image of the declared
// type — a renamed .exe or HTML file with an image/* content type fails.
export async function looksLikeImage(file: File): Promise<boolean> {
  const b = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const ascii = (from: number, to: number) => String.fromCharCode(...b.slice(from, to));
  switch (file.type) {
    case "image/jpeg": return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
    case "image/png": return b[0] === 0x89 && ascii(1, 4) === "PNG";
    case "image/gif": return ascii(0, 4) === "GIF8";
    case "image/webp": return ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP";
    case "image/avif": return ascii(4, 8) === "ftyp" && /avif|avis|mif1/.test(ascii(8, 16));
    default: return true; // video: not byte-checked here
  }
}
