"use client";

// The heart on an item: saves it to the member's list (and takes it off again). Signed-out visitors are sent to sign in by the caller.
export default function FavoriteButton({ saved, onToggle, label, className = "" }: { saved: boolean; onToggle: () => void; label: string; className?: string }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggle(); }}
      aria-pressed={saved}
      aria-label={saved ? `Remove ${label} from saved items` : `Save ${label}`}
      title={saved ? "Saved: tap to remove" : "Save this item"}
      className={`flex h-9 w-9 items-center justify-center rounded-full border border-rule bg-white/95 text-lg leading-none shadow-sm transition hover:scale-105 ${saved ? "text-crimson" : "text-slate"} ${className}`}
    >
      <span aria-hidden="true">{saved ? "♥" : "♡"}</span>
    </button>
  );
}
