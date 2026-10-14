import Link from "next/link";

type Item = { title: string; copy: string; href?: string };

// Feature cards in groups of five: one big crimson card on the left (the one in the group with the most to say, so its full text has
// room) and four smaller cards beside it, two by two. Cards left over at the end sit in an ordinary row. Used on the home and About pages.
export default function FeatureMosaic({ items, className = "" }: { items: Item[]; className?: string }) {
  const groups: Item[][] = [];
  for (let i = 0; i < items.length; i += 5) groups.push(items.slice(i, i + 5));
  return (
    <div className={`grid gap-6 ${className}`}>
      {groups.map((g, gi) => {
        if (g.length < 5) return <div key={gi} className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">{g.map((f) => <Card key={f.title} f={f} />)}</div>;
        const big = g.reduce((a, b) => (b.copy.length > a.copy.length ? b : a));
        const rest = g.filter((f) => f !== big);
        return (
          <div key={gi} className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <Card f={big} big />
            {rest.map((f) => <Card key={f.title} f={f} />)}
          </div>
        );
      })}
    </div>
  );
}

function Card({ f, big = false }: { f: Item; big?: boolean }) {
  const cls = big ? "rounded-xl2 bg-crimson-deep p-7 text-paper shadow-lg sm:col-span-2 lg:col-span-1 lg:row-span-2" : "card p-7";
  const style = big ? { backgroundImage: "linear-gradient(160deg, #4E0119 0%, #7A0328 100%)" } : undefined;
  const inner = (
    <>
      <h3 className={`font-ui text-base font-bold ${big ? "text-paper lg:font-display lg:text-3xl lg:font-normal" : "text-ink"}`}>{f.title}</h3>
      <p className={`mt-2 text-sm ${big ? "text-paper/85 lg:mt-4 lg:text-base" : "text-slate"}`}>{f.copy}</p>
    </>
  );
  return f.href ? <Link href={f.href} className={`${cls} block hover:shadow-md`} style={style}>{inner}</Link> : <div className={cls} style={style}>{inner}</div>;
}
