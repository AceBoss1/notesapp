// Puff-Puff Rush's catalogue entry, kept here until it moves into lib/arcade/catalogue.ts.
import type { ArcadeGame } from "./catalogue";

export const ENTRY: ArcadeGame = {
  slug: "puffpuff",
  path: "/arcade/puffpuff",
  name: "Puff-Puff Rush",
  kicker: "Action",
  headline: ["Grab the", "puff-puff."],
  blurb: "Ride the market lanes, grab every puff-puff, dodge the goats.",
  description: "You're on a little delivery bike in a busy market, and there's puff-puff all along the lanes. Collect every one before the market's goats catch you. Grab a bowl of pepper soup and, for a few seconds, the goats run scared, so you can send them back to their pen for bonus points.",
  howTo: [
    "Arrow keys or W A S D to ride; swipe or use the arrows on a phone. Press a turn early and the bike takes it at the next corner.",
    "Each puff-puff is 10 points, a bowl of pepper soup 50.",
    "After pepper soup the goats run scared for a few seconds: catch one to send it back to its pen for 200, 400, 800, then 1600.",
    "A bottle of zobo turns up now and then below the pen. Grab it for bonus points before it goes.",
    "Clear every puff-puff to move on to the next market. A goat that catches you costs a life; you have 3.",
    "After each game, Nana, free and built in, tells you which goat got you and how to time the pepper soup; pause for a tip on which way to ride. She sits out tournaments.",
  ],
  players: "One player",
  shots: [{ caption: "Chill", level: "chill" }, { caption: "Normal", level: "normal" }, { caption: "Fast", level: "fast" }],
};
