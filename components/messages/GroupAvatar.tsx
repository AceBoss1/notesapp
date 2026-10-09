// A group's picture: its initials on a maroon square (team rooms in gold-edged maroon).
export default function GroupAvatar({ title, size = 44, team = false }: { title: string; size?: number; team?: boolean }) {
  const initials = title.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "#";
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-2xl bg-crimson font-ui font-extrabold text-white ${team ? "ring-2 ring-amber-400" : "border border-rule"}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
    >
      {initials}
    </span>
  );
}
