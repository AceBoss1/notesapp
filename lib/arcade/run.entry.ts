// Naija Run's catalogue entry, kept apart until the lead moves it into lib/arcade/catalogue.ts.
import type { ArcadeGame } from "./catalogue";

export const ENTRY: ArcadeGame = {
  slug: "run", path: "/arcade/run", name: "Naija Run", kicker: "Action", headline: ["Run", "the street."],
  blurb: "Dash down a Lagos street at dusk: jump, slide, dodge, grab coins.",
  description: "Evening on a busy Lagos street and you're late. Run down three lanes, hop the potholes and puddles, slide under market-stall awnings and banners, and swerve round parked danfos and wheelbarrows. Grab coins on the way and the odd hot pepper. The longer you last, the faster it gets.",
  howTo: [
    "Left and right (arrow keys, A D, or swipe) to change lane.",
    "Up, W or space to jump potholes and puddles; tap the road to jump on a phone.",
    "Down or S (swipe down) to slide under awnings and banners. Danfos and wheelbarrows: change lane.",
    "Every metre is a point and every coin is 10. A pepper gives 5 seconds of double points and you barge through anything.",
    "Hit something and the run ends. Pick a speed: chill, normal or fast.",
    "After each run, Nana, free and built in, tells you what tripped you up and how to go further; pause for a tip on what's coming. She sits out tournaments.",
  ],
  players: "One player",
  shots: [{ caption: "Chill", level: "chill" }, { caption: "Normal", level: "normal" }, { caption: "Fast", level: "fast" }],
};
