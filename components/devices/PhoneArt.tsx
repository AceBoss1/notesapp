// A drawn NotesPhone, in the colour chosen (no product photos yet: the factory's pictures are theirs, and the colours aren't
// confirmed). Pure markup, so it works on the server and in the form.
export default function PhoneArt({ swatch, label, small = false }: { swatch: string; label: string; small?: boolean }) {
  const light = ["#F4EEDF", "#C9CBCF", "#C9A24B"].includes(swatch);
  return (
    <div role="img" aria-label={`NotesPhone in ${label}`} className={`relative mx-auto ${small ? "h-40 w-20" : "h-72 w-36 sm:h-80 sm:w-40"} rounded-[2rem] p-[5px] shadow-xl`} style={{ background: swatch, boxShadow: "0 24px 48px rgba(26,18,16,0.28)" }}>
      <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden rounded-[1.7rem] bg-[#1A1210]" style={{ backgroundImage: "radial-gradient(18rem 14rem at 50% 0%, rgba(166,9,61,0.85), transparent 70%), linear-gradient(180deg,#340515,#1A1210)" }}>
        <span className="absolute top-2 h-2 w-2 rounded-full bg-black/70 ring-1 ring-white/10" />
        <span className={`font-ui font-extrabold text-white ${small ? "text-[11px]" : "text-base"}`}>#NotesApp</span>
        <span className={`mt-1 font-display text-white/80 ${small ? "text-[9px]" : "text-xs"}`}>NotesPhone</span>
      </div>
      <span className={`absolute -right-[3px] top-20 h-10 w-[3px] rounded-r ${light ? "bg-black/20" : "bg-white/25"}`} />
    </div>
  );
}
