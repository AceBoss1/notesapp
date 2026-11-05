/** @type {import('next').NextConfig} */
const nextConfig = {
  // The certificate picture (app/(main)/certificates/[id]/image.png, lib/certificate-image.tsx) and course covers (lib/cover-render.tsx)
  // read their fonts and our badges from the disk.
  experimental: {
    outputFileTracingIncludes: {
      "/certificates/[id]/image.png": ["./assets/fonts/**", "./assets/certificate-logo.png", "./public/images/academy/*.png", "./public/images/brand/icon-512.png"],
      // Course covers made with Nana (lib/cover-render.tsx): the fonts, our mark, and Next's own WebP encoder (WebAssembly).
      "/api/academy/covers": ["./assets/fonts/**", "./public/images/brand/icon-512.png", "./node_modules/next/dist/server/lib/squoosh/**"],
      // The permanent NotesApp mark (lib/media-watermark.tsx): Next's own picture codecs (WebAssembly) and the Inter fonts, wherever a
      // picture is marked, a video's watermark profile is drawn, or the re-marking job runs.
      "/api/media/posts/[id]/download": ["./node_modules/next/dist/server/lib/squoosh/**", "./assets/fonts/Inter-*.ttf"],
      "/api/media/posts": ["./node_modules/next/dist/server/lib/squoosh/**", "./assets/fonts/Inter-*.ttf"],
      "/api/media/video": ["./assets/fonts/Inter-*.ttf"],
      "/api/media/studio": ["./node_modules/next/dist/server/lib/squoosh/**", "./assets/fonts/Inter-*.ttf"],
      "/api/upload/mark": ["./node_modules/next/dist/server/lib/squoosh/**", "./assets/fonts/Inter-*.ttf"],
      "/api/admin/media-marks": ["./node_modules/next/dist/server/lib/squoosh/**", "./assets/fonts/Inter-*.ttf"],
      "/api/cron/reminders": ["./node_modules/next/dist/server/lib/squoosh/**", "./assets/fonts/Inter-*.ttf"],
      "/api/replays": ["./assets/fonts/Inter-*.ttf"],
    },
  },
  // pdf.js (the view-only PDF viewer, components/PdfViewer.tsx) has an optional Node "canvas" import it never uses in the browser.
  webpack: (config) => {
    config.resolve.alias = { ...(config.resolve.alias || {}), canvas: false };
    return config;
  },
  // Google sign-in's helper pages, served on our own addresses (NEXT_PUBLIC_FIREBASE_AUTH_ON_SITE, lib/firebase.ts).
  async rewrites() {
    const d = (process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "").trim();
    if (!/^[a-z0-9-]+\.(firebaseapp\.com|web\.app)$/.test(d)) return [];
    return [
      { source: "/__/auth/:path*", destination: `https://${d}/__/auth/:path*` },
      { source: "/__/firebase/:path*", destination: `https://${d}/__/firebase/:path*` },
    ];
  },
  images: {
    remotePatterns: [
      // Legacy — pre-migration Cloudinary URLs may still exist on old
      // notes until re-uploaded; harmless to keep listed.
      { protocol: "https", hostname: "res.cloudinary.com" },
      // The actual bug: next/image blocks any domain not listed here,
      // silently, with no error visible outside the browser console —
      // which is exactly why a new R2 image showed correctly in OG/
      // link-preview meta tags (a raw URL, no domain check at all)
      // but never rendered on the real page (next/image, which does
      // check). media.notesapp.name.ng is the custom domain mapped to
      // the R2 bucket — see NEXT_PUBLIC_R2_PUBLIC_URL in
      // .env.local.example. If that env var ever points at a
      // different domain (e.g., Cloudflare's own pub-<hash>.r2.dev
      // instead of a custom domain), add that hostname here too.
      { protocol: "https", hostname: "media.notesapp.name.ng" },
    ],
  },
};

module.exports = nextConfig;
