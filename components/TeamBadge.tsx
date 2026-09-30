// "#NotesApp team" mark: shown beside the ✔ for #NotesApp staff, guest
// writers (internal roles) and the official accounts.
export default function TeamBadge({ size = 16 }: { size?: number }) {
  const label = "#NotesApp team — staff, guest writer or official account";
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/images/brand/notesapp-icon.webp"
      alt={label}
      title={label}
      width={size}
      height={size}
      className="ml-0.5 inline-block flex-shrink-0 rounded-[4px] align-middle"
      style={{ width: size, height: size }}
    />
  );
}
