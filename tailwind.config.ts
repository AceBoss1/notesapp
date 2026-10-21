import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#1A1210",         // near-black, warm — primary text
        // paper is a CSS variable too, with this value as the fallback: a member's site can choose a white background (lib/site-themes.ts).
        paper: "rgb(var(--c-paper, 251 246 242) / <alpha-value>)", // #FBF6F2 warm ivory w/ a whisper of rose — page background
        // NotesApp signature, drawn straight from the mark (#7A0328, #A6093D, #4E0119). Written as CSS variables with those values as the
        // fallback, so a member's site can use its own colour set (lib/site-themes.ts paletteVars); everywhere else it is exactly the crimson.
        crimson: "rgb(var(--c-crimson, 122 3 40) / <alpha-value>)",
        "crimson-bright": "rgb(var(--c-crimson-bright, 166 9 61) / <alpha-value>)",
        "crimson-deep": "rgb(var(--c-crimson-deep, 78 1 25) / <alpha-value>)",
        moss: "#3D5A45",        // secondary accent — ledger/growth green, used sparingly
        slate: "#5C534E",       // secondary text
        rule: "#E7DAD3",        // hairline dividers
        card: "#FFFFFF",
      },
      fontFamily: {
        display: ["Newsreader", "serif"],
        ui: ["Manrope", "sans-serif"],
        body: ["Inter", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      letterSpacing: {
        wideish: "0.04em",
        eyebrow: "0.14em",
      },
      borderRadius: {
        xl2: "1.25rem",
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
export default config;
