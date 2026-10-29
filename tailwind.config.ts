import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ink, paper, slate, rule and card are CSS variables too, with these values as the fallback: the Scholar look's dark mode on a member's
        // site turns them round (app/globals.css), and a site can choose a white background (lib/site-themes.ts). Everywhere else they are
        // exactly these colours.
        ink: "rgb(var(--c-ink, 26 18 16) / <alpha-value>)", // #1A1210 near-black, warm — primary text
        paper: "rgb(var(--c-paper, 251 246 242) / <alpha-value>)", // #FBF6F2 warm ivory w/ a whisper of rose — page background
        // NotesApp signature, drawn straight from the mark (#7A0328, #A6093D, #4E0119). Written as CSS variables with those values as the
        // fallback, so a member's site can use its own colour set (lib/site-themes.ts paletteVars); everywhere else it is exactly the crimson.
        crimson: "rgb(var(--c-crimson, 122 3 40) / <alpha-value>)",
        "crimson-bright": "rgb(var(--c-crimson-bright, 166 9 61) / <alpha-value>)",
        "crimson-deep": "rgb(var(--c-crimson-deep, 78 1 25) / <alpha-value>)",
        moss: "#3D5A45",        // secondary accent — ledger/growth green, used sparingly
        slate: "rgb(var(--c-slate, 92 83 78) / <alpha-value>)", // #5C534E secondary text
        rule: "rgb(var(--c-rule, 231 218 211) / <alpha-value>)", // #E7DAD3 hairline dividers
        card: "rgb(var(--c-card, 255 255 255) / <alpha-value>)", // #FFFFFF
        field: "rgb(var(--c-field, 243 236 231) / <alpha-value>)", // #F3ECE7 search boxes and soft circles in the header (maroon at Night)
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
