import { slugify } from "./courses";
import type { CoverSpec } from "./covers";

// Hand-picked designs for Notes Academy's own courses, drawn without the AI by scripts/course-covers.ts into
// public/images/academy/covers/<slug>.webp (the course seeds use these files). Every template appears at least once.
const S = (title: string, spec: Omit<CoverSpec, "headline">): { title: string; slug: string; spec: CoverSpec } => ({ title, slug: slugify(title), spec: { headline: title, ...spec } });

export const SAMPLE_COVERS = [
  S("How to Restart Your Life After a Breakdown", { template: "arch", palette: "earth", pattern: "mudcloth", icon: "sunrise", subline: "Small, steady steps back to yourself", tag: "Life skills course", layout: "left" }),
  S("IT Support Training", { template: "band", palette: "indigo", pattern: "adire", icon: "headset", subline: "Fix computers, phones and networks with confidence", tag: "Beginner course", layout: "left" }),
  S("AI for Everyday Africans", { template: "medallion", palette: "crimson", pattern: "kente", icon: "chip", subline: "Use AI for work, money and home, in plain words", tag: "Free course", layout: "left" }),
  S("AI for Small Businesses and Traders", { template: "split", palette: "gold", pattern: "mudcloth", icon: "shop", subline: "Sell more and save time with simple AI tools", tag: "Beginner course", layout: "left" }),
  S("AI for Farmers and Agribusiness", { template: "tiles", palette: "moss", pattern: "adire", icon: "wheat", subline: "Weather, prices, pests and planning with AI", tag: "Beginner course", layout: "right" }),
  S("AI for Teachers, Schools and Students", { template: "frame", palette: "ivory", pattern: "kente", icon: "school", subline: "Lesson plans, marking and learning with AI", tag: "Beginner course", layout: "center" }),
  S("AI for NGOs, Churches and Public Organisations", { template: "stripes", palette: "teal", pattern: "kente", icon: "people", subline: "Serve your people better with AI", tag: "Beginner course", layout: "left" }),
  S("AI Careers and Freelancing in Africa", { template: "poster", palette: "ink", pattern: "diamonds", icon: "rocket", subline: "Find work, win clients and get paid with AI skills", tag: "Career course", layout: "left" }),
  S("AI for Professionals", { template: "band", palette: "crimson", pattern: "diamonds", icon: "laptop", subline: "Write, analyse and plan faster at work", tag: "Intermediate course", layout: "right" }),
];
