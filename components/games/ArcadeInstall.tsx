"use client";

import InstallGuide from "@/components/InstallGuide";

// Installing Notes Arcade as its own app (owner, 21 Nov 2026): the same steps as #NotesApp's install guide, with the Arcade's name, the
// green [na] icon and a way back to the games. The app itself comes from app/(arcade)/arcade/manifest.webmanifest.
export default function ArcadeInstall() {
  return (
    <div className="arcade-install">
    <InstallGuide
      app={{
        name: "Notes Arcade",
        icon: "/images/brand/arcade-icon-192.png",
        home: "/arcade",
        homeLabel: "← Back to all the games",
        calls: false,
        brand: <span className="font-ui text-lg font-extrabold tracking-tight text-ink">NOTES <span style={{ color: "#3f8a1c" }}>ARCADE</span></span>,
      }}
    />
    {/* The guide is styled for #NotesApp (crimson); here its accents take the Arcade icon's green. */}
    <style jsx global>{`
      .arcade-install .bg-crimson { background-color:#2f6a12 !important; }
      .arcade-install .text-crimson { color:#2f6a12 !important; }
      .arcade-install .border-crimson, .arcade-install .hover\:border-crimson:hover { border-color:#2f6a12 !important; }
      .arcade-install .btn-primary { background:#2f6a12 !important; border-color:#2f6a12 !important; }
    `}</style>
    </div>
  );
}
