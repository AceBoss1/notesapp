/** @type {import('next').NextConfig} */
const nextConfig = {
  // The certificate picture (app/(main)/certificates/[id]/image.png, lib/certificate-image.tsx) reads its fonts and our badges from the disk.
  experimental: {
    outputFileTracingIncludes: {
      "/certificates/[id]/image.png": ["./assets/fonts/**", "./assets/certificate-logo.png", "./public/images/academy/*.png", "./public/images/brand/icon-512.png"],
    },
  },
  // pdf.js (the view-only PDF viewer, components/PdfViewer.tsx) has an optional Node "canvas" import it never uses in the browser.
  webpack: (config) => {
    config.resolve.alias = { ...(config.resolve.alias || {}), canvas: false };
    return config;
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
