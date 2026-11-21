// Notes Arcade: every game, its page, what it is and how to play. The Arcade home (app/(arcade)/arcade/page.tsx) lists these,
// and each game page reads its own entry for the side panel. Screenshots live in public/images/arcade/<slug>.png
// (scripts/arcade-shots.mjs takes them). Every game here is our own build: no other company's names, art or boards.

// The newer games keep their entries beside their code (lib/arcade/<slug>.entry.ts); they're listed here with the rest.
import { ENTRY as ACHI } from "./achi.entry";
import { ENTRY as RUN } from "./run.entry";
import { ENTRY as PUFFPUFF } from "./puffpuff.entry";

export type ArcadeGame = {
  slug: string;
  path: string; // where the game lives on the main site
  name: string;
  kicker: string; // the small label above the title: "Board", "Cards"…
  headline: [string, string]; // the big two-line title on the game page; the second line is in italics
  blurb: string; // one line for the Arcade home
  description: string; // the paragraph on the game page and the help article
  howTo: string[]; // the rules, short
  players: string; // "You vs the computer"…
  // The gallery on the game page: one screenshot per level (games with an easy/medium/hard choice) or per stage of a game.
  // Files are public/images/arcade/<slug>-1.png, -2.png… in this order (scripts/arcade-shots.mjs).
  shots: { caption: string; level?: string }[];
};

const LEVELS = [{ caption: "Easy", level: "easy" }, { caption: "Medium", level: "medium" }, { caption: "Hard", level: "hard" }];
const STAGES = [{ caption: "The start" }, { caption: "Mid-game" }, { caption: "Later on" }];

export const ARCADE_GAMES: ArcadeGame[] = [
  {
    slug: "snake", path: "/snake", name: "Snake", kicker: "The classics", headline: ["Stay", "hungry."],
    blurb: "Eat, grow, don't bump into yourself.",
    description: "One little snake. A lot of snacks. Steer it round the board, eat to grow longer, and see how long you can keep going before you run into your own tail.",
    howTo: ["Arrow keys or W A S D to steer; the arrows on a phone.", "Each snack is 10 points and makes you longer.", "Hit yourself and the run ends. Pick a speed: chill, classic or fast."],
    players: "One player",
    shots: [{ caption: "Chill", level: "chill" }, { caption: "Classic", level: "classic" }, { caption: "Fast", level: "fast" }],
  },
  {
    slug: "ludo", path: "/arcade/ludo", name: "Ludo", kicker: "Board", headline: ["Roll", "home."],
    blurb: "Four colours, two dice (or one), race your four seeds home.",
    description: "The race game every Nigerian home knows. Roll the dice, bring your seeds out on a six, race them round the board and into your home column. Land on another colour and send it back to its yard. Play with two dice or one, and switch on 6 + 5 straight home if that's how you play it at home.",
    howTo: [
      "Choose 2 dice (the default) or 1 die at the top. Changing it starts a new game.",
      "With 2 dice, use each die on its own: on one seed or two, in either order. A 6 on either die brings a seed out of your yard. A die you can't use is lost.",
      "With 2 dice, a double 6 gives you another roll. With 1 die, any 6 does. Three in a row and you lose the turn.",
      "6+5 HOME is off unless you turn it on. Then a 6 and a 5 can send a seed from your yard straight home instead. With 1 die, that's a 6 that brings a seed out, then a 5 on the extra roll. It's your choice.",
      "Land on another player's seed to send it back to its yard and roll again. Star and start squares are safe.",
      "You need the exact roll to get home. Get all four seeds home first to win.",
    ],
    players: "You vs 3 computer players",
    shots: STAGES,
  },
  {
    slug: "whot", path: "/arcade/whot", name: "Whot", kicker: "Cards", headline: ["Check", "up!"],
    blurb: "Match shape or number, play your specials, empty your hand.",
    description: "The Naija card game of circles, triangles, crosses, squares and stars. Match the card on the pile by shape or number, use your specials to make the other player pick, and be the first to empty your hand.",
    howTo: ["Play a card that matches the top card's shape or number.", "1 Hold on: play again. 2 Pick two. 5 Pick three. 8 Suspension: the other player misses a turn. 14 General market: everyone else picks one.", "20 is Whot: play it on anything, then ask for a shape.", "No card to play? Go to market and pick one.", "First to empty their hand wins."],
    players: "You vs the computer",
    shots: STAGES,
  },
  {
    slug: "spades", path: "/arcade/spades", name: "Ace of Spades", kicker: "Cards", headline: ["Spades", "are trumps."],
    blurb: "Bid your tricks, partner up, spades beat everything.",
    description: "A four-player trick-taking game: you and your partner across the table against two computer players. Bid how many tricks you'll take, follow suit when you can, and remember spades are always trumps.",
    howTo: ["Everyone gets 13 cards and bids how many tricks they'll win.", "Follow the suit that was led if you can. If you can't, play anything, including a spade.", "The highest spade wins the trick; with no spades, the highest card of the suit led.", "Spades can't be led until one has been played.", "Make your team's bid: 10 points a trick bid, 1 for each extra. Miss it and lose 10 a trick. First team to 250 wins."],
    players: "You and a partner vs 2 computer players",
    shots: STAGES,
  },
  {
    slug: "landlord", path: "/arcade/landlord", name: "Naija Landlord", kicker: "Board", headline: ["Buy the", "street."],
    blurb: "Buy plots and markets across Naija, build, collect rent.",
    description: "Our own property-trading game. Roll round a board of Nigerian neighbourhoods and big markets, from Ariaria and Nkwo Nnewi to Alaba and the Trade Fair, buy the plots you land on, own a whole city to build flats, and collect rent from everyone who stops on your street. The last player with money wins, or the richest after 80 rounds.",
    howTo: ["Roll two dice and move. Buy any plot nobody owns.", "Land on someone's plot and pay them rent.", "Own every plot in a city to build flats; flats raise the rent.", "Pass Start to collect your salary. Market and Fortune squares draw a card.", "Run out of money and you're out. Last landlord standing wins, or the richest after 80 rounds."],
    players: "You vs 3 computer players",
    shots: STAGES,
  },
  {
    slug: "ncho", path: "/arcade/ncho", name: "Ncho", kicker: "Board", headline: ["Sow", "and gather."],
    blurb: "The Igbo seed game: relay-sow, make 4, conquer houses.",
    description: "Ncho (also Nchokoto or Nchokoroto, by dialect) is Igbo mancala, cousin of Ayo and Oware. Sow seeds round the board, keep going from wherever your last seed lands, take the 4s you make, and win your opponent's holes (houses) over a number of rounds you choose. Played on a board of two rows of 6 holes.",
    howTo: ["Each player owns the holes (houses) on their row, 4 seeds in each, and has a store for captured seeds. Your holes have green rings, the computer's amber.", "Pick up all the seeds from one of your holes and sow them one by one, anticlockwise, round and round. No hole is skipped and seeds never go in a store.", "Relay sowing: if your last seed lands in an empty hole, your turn ends. If it makes exactly 4, you take those 4, on either side, and your turn ends. Otherwise lift all the seeds from that hole and keep sowing.", "Any hole that reaches exactly 4 on the way, before the last seed, goes straight to that hole's owner, whoever is sowing.", "A round ends when the player to move has no seeds in their holes. Each of you adds the seeds in your holes to your store, then refills your holes with 4 each. A hole you can't fill is conquered by your opponent, and conquered holes are theirs to play next round.", "Choose 3, 5 or 7 rounds, or play until one side has every house. Most houses wins, and the loser of each round starts the next."],
    players: "You vs the computer",
    shots: LEVELS,
  },
  {
    slug: "akahausa", path: "/arcade/akahausa", name: "Ncho Aka-Hausa", kicker: "Board", headline: ["The other", "way round."],
    blurb: "Ncho the other way round: relay-sow clockwise against a sharper computer.",
    description: "Aka-Hausa is Ncho played the reverse way. The rules are exactly the same, relay sowing, taking 4s and conquering houses over the rounds you choose, but the seeds go round clockwise, so everything you know about the board turns around, and the computer thinks further ahead at every level.",
    howTo: ["The same board: each player owns a row of holes (houses) with 4 seeds in each, and a store. Your holes have green rings, the computer's amber.", "Pick up all the seeds from one of your holes and sow them one by one, clockwise, round and round, never skipping a hole.", "Relay sowing: last seed in an empty hole ends your turn; making exactly 4 lets you take them, on either side, and ends your turn; anything else, lift all the seeds there and keep sowing.", "Any hole that reaches exactly 4 on the way, before the last seed, goes straight to that hole's owner.", "When the player to move has no seeds in their holes, the round ends: count your seeds, refill your holes with 4 each, and any hole you can't fill is conquered by your opponent.", "Choose 3, 5 or 7 rounds, or play until one side has every house. Most houses wins, and the loser of each round starts the next."],
    players: "You vs the computer",
    shots: LEVELS,
  },
  {
    slug: "chess", path: "/arcade/chess", name: "Chess", kicker: "Board", headline: ["Your", "move."],
    blurb: "The full game against the computer, three levels.",
    description: "The full game of chess against the computer, with castling, en passant and promotion. Pick a level, play white or black, and see the moves you can make when you tap a piece.",
    howTo: ["Tap a piece to see where it can go, then tap a square.", "Checkmate the other king to win. Stalemate is a draw.", "Pawns promote when they reach the far side.", "Pick a level: easy, medium or hard."],
    players: "You vs the computer",
    shots: LEVELS,
  },
  {
    slug: "draughts", path: "/arcade/draughts", name: "Draughts", kicker: "Board", headline: ["Jump", "and crown."],
    blurb: "African or English rules: forced jumps, crown your kings.",
    description: "Draughts on an 8×8 board, played the African way by default (men take backwards, kings fly the length of the board, take the most you can) or by English rules. Move diagonally forward, jump the other player's pieces to capture them, and reach the far row to crown a king.",
    howTo: ["Pieces step one square diagonally forward onto dark squares.", "If you can jump, you must, and keep jumping while you can. African rules: men may also jump backwards, and you must take the most pieces you can.", "Reach the far row to become a king. African kings fly any distance along a clear diagonal and capture from afar; English kings move one square either way.", "African rules: a man is only crowned if its move ends on the far row. English rules: reaching it crowns and ends the move.", "Take every piece, or leave the other player with no move, to win. 40 moves each without a capture is a draw (you can switch this off)."],
    players: "You vs the computer",
    shots: LEVELS,
  },
  ACHI,
  RUN,
  PUFFPUFF,
];

export function arcadeGame(slug: string): ArcadeGame {
  const g = ARCADE_GAMES.find((x) => x.slug === slug);
  if (!g) throw new Error(`No arcade game ${slug}`);
  return g;
}

// Short paths on arcade.<domain>: arcade.naapp.tech/ludo → /arcade/ludo (middleware.ts).
export const ARCADE_SLUGS = ARCADE_GAMES.filter((g) => g.path.startsWith("/arcade/")).map((g) => g.slug);
