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
        paper: "#FBF6F2",       // warm ivory w/ a whisper of rose — page background
        crimson: "#7A0328",     // NotesApp signature — drawn straight from the mark
        "crimson-bright": "#A6093D",
        "crimson-deep": "#4E0119",
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
