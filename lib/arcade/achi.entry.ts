import type { ArcadeGame } from "@/lib/arcade/catalogue";

// Achi's catalogue entry, kept here until it moves into lib/arcade/catalogue.ts. Rules match lib/arcade/achi.ts.
export const ENTRY: ArcadeGame = {
  slug: "achi",
  path: "/arcade/achi",
  name: "Achi",
  kicker: "Board",
  headline: ["Three", "in a line."],
  blurb: "Place three, then slide them: first to fill a line wins.",
  description: "Achi is the traditional West African name for a family of three-in-a-row games, played in Ghana and across the region on a board drawn in the sand or on paper. You each have three pieces and nine points joined by eight lines. Put your pieces down, then slide them along the lines, and be the first to fill a whole line.",
  howTo: [
    "The board has nine points and eight lines: the four outside edges, the middle row and column through the centre, and the two diagonals.",
    "Each player has three pieces. Take turns placing one on any empty point.",
    "Once all six are down, take turns sliding one of your pieces along a line to the next point, if it's empty.",
    "Get your three pieces on any one line and you win, while placing or moving.",
    "If it's your turn and you can't move, you lose. The same position three times, or 60 turns with no winner, is a draw. The loser starts the next game.",
    "Stuck? Nana, free and built in, lights up the move she'd play and says why, and explains each computer move. Switch her off any time.",
  ],
  players: "You vs the computer",
  shots: [{ caption: "Easy", level: "easy" }, { caption: "Medium", level: "medium" }, { caption: "Hard", level: "hard" }],
};
