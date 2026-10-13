// A group's picture: the one an admin chose, or its initials on a maroon square (team rooms in gold-edged maroon).
export default function GroupAvatar({ title, size = 44, team = false, src }: { title: string; size?: number; team?: boolean; src?: string }) {
  const initials = title.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "#";
  const ring = team ? "ring-2 ring-amber-400" : "border border-rule";
  if (src && !team) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt="" aria-hidden width={size} height={size} className={`shrink-0 rounded-2xl object-cover ${ring}`} style={{ width: size, height: size }} />
    );
  }
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-2xl bg-crimson font-ui font-extrabold text-white ${ring}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
    >
      {initials}
    </span>
  );
}
