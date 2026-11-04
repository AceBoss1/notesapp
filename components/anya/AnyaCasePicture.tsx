"use client";

import Image from "next/image";
import { useState } from "react";

// A case picture on /anya. When a case comes in more than one colour, round swatches under the picture switch between them, with a
// short dissolve; the chosen colour's name is shown beside them.
export type CaseColour = { name: string; swatch: string; src: string; alt: string };

export default function AnyaCasePicture({ colours, bg, fit }: { colours: CaseColour[]; bg: string; fit: string }) {
  const [shown, setShown] = useState(0);
  return (
    <div>
      <div className={`relative aspect-[4/3.4] ${bg}`}>
        {colours.map((c, i) => (
          <Image
            key={c.src}
            src={c.src}
            alt={c.alt}
            fill
            sizes="(min-width: 768px) 360px, 100vw"
            aria-hidden={i !== shown}
            className={`${fit} transition-opacity duration-500 ${i === shown ? "opacity-100" : "opacity-0"}`}
          />
        ))}
      </div>
      {colours.length > 1 && (
        <div className="flex items-center gap-3 px-6 pt-4" role="radiogroup" aria-label="Case colour">
          {colours.map((c, i) => (
            <button
              key={c.name}
              type="button"
              role="radio"
              aria-checked={i === shown}
              aria-label={c.name}
              onClick={() => setShown(i)}
              className={`h-7 w-7 rounded-full border-2 transition ${i === shown ? "border-crimson ring-2 ring-crimson/25" : "border-rule hover:border-slate"}`}
              style={{ background: c.swatch }}
            />
          ))}
          <span className="font-ui text-sm text-slate">{colours[shown].name}</span>
        </div>
      )}
    </div>
  );
}
