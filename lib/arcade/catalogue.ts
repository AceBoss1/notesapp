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
    howTo: ["Arrow keys or W A S D to steer; the arrows on a phone.", "Each snack is 10 points and makes you longer.", "Hit yourself and the run ends. Pick a speed: chill, classic or fast.", "After each run, Nana, free and built in, tells you what went wrong and how to go further. She sits out tournaments."],
    players: "One player",
    shots: [{ caption: "Chill", level: "chill" }, { caption: "Classic", level: "classic" }, { caption: "Fast", level: "fast" }],
  },
  {
    slug: "ludo", path: "/arcade/ludo", name: "Ludo", kicker: "Board", headline: ["Roll", "home."],
    blurb: "Four colours, two dice (or one), race your four seeds home.",
    description: "The race game every Nigerian home knows. Roll the dice, bring your seeds out on a six, race them round the board and into your home column. Land on another colour and send it back to its yard. Play with two dice or one, send the hitter straight home or not, and switch on 6 + 5 straight home if that's how you play it at home. Play four players, take two yards against the computer, or play a knockout where the last one home is out.",
    howTo: [
      "Pick a MODE at the top. 4 PLAYERS: you're green against three computers. Changing the mode, the dice or a rule starts a new game.",
      "2 V 2 YARDS: before you start, tap any two colours to make them yours, side by side or opposite. The computer plays the other two. Each colour still takes its own turn. Your two colours share squares and never capture each other. Get all 8 seeds home first to win.",
      "KNOCKOUT: you against three computers. When someone gets all four home the game goes on, until only one player is left. That player is out. The three left play a fresh round with the empty yard skipped, and the last one home is out again. The final two play two yards each, and the first to get all 8 home wins.",
      "Choose 2 dice (the default) or 1 die.",
      "A 6 brings a seed out of your yard. With 2 dice, a 6 on either die does.",
      "A double 6 (with 1 die, any 6) is banked and you roll again. Keep rolling until you throw something else, then spend every die you banked, one at a time, in any order, on one seed or several. A die you can't use is lost. Three in a row and you lose the turn.",
      "6+5 HOME is off unless you turn it on. Then a banked 6 and 5 can send a seed from your yard straight home instead. It's your choice.",
      "Land on another player's seed to send it back to its yard. A capture doesn't earn another roll: only a 6 (1 die) or a double 6 (2 dice) does. With HIT → HOME on (the default), the seed that hits goes straight home. Only the star squares are safe: land on a start square and the seed sitting there goes back to its yard.",
      "You need the exact roll to get home. With 4 players, get all four seeds home first to win.",
      "Stuck? Nana, free and built in, lights up the seed she'd move and says why, and explains each computer move. Switch her off any time.",
    ],
    players: "You vs 1 to 3 computers",
    shots: STAGES,
  },
  {
    slug: "whot", path: "/arcade/whot", name: "Whot", kicker: "Cards", headline: ["Check", "up!"],
    blurb: "Match shape or number, play your specials, empty your hand.",
    description: "The Naija card game of circles, triangles, crosses, squares and stars. Match the card on the pile by shape or number, use your specials to make the other player pick, and be the first to empty your hand.",
    howTo: ["Play a card that matches the top card's shape or number.", "1 Hold on: play again. 2 Pick two. 5 Pick three. 8 Suspension: the other player misses a turn. 14 General market: everyone else picks one.", "20 is Whot: play it on anything, then ask for a shape.", "No card to play? Go to market and pick one.", "First to empty their hand wins.", "Stuck? Nana, free and built in, suggests a play from what you can see and explains the computer's moves. Switch her off any time."],
    players: "You vs the computer",
    shots: STAGES,
  },
  {
    slug: "spades", path: "/arcade/spades", name: "Ace of Spades", kicker: "Cards", headline: ["Spades", "are trumps."],
    blurb: "Bid your tricks, partner up, spades beat everything.",
    description: "A four-player trick-taking game: you and your partner across the table against two computer players. Bid how many tricks you'll take, follow suit when you can, and remember spades are always trumps.",
    howTo: ["Everyone gets 13 cards and bids how many tricks they'll win.", "Follow the suit that was led if you can. If you can't, play anything, including a spade.", "The highest spade wins the trick; with no spades, the highest card of the suit led.", "Spades can't be led until one has been played.", "Make your team's bid: 10 points a trick bid, 1 for each extra. Miss it and lose 10 a trick. First team to 250 wins.", "Stuck? Nana, free and built in, suggests a play from what you can see and explains the computer's moves. Switch her off any time."],
    players: "You and a partner vs 2 computer players",
    shots: STAGES,
  },
  {
    slug: "landlord", path: "/arcade/landlord", name: "Naija Landlord", kicker: "Board", headline: ["Buy the", "street."],
    blurb: "Buy plots and markets across Naija, build, collect rent.",
    description: "Our own property-trading game. Roll round a board of Nigerian neighbourhoods and big markets, from Ariaria and Nkwo Nnewi to Alaba and the Trade Fair, buy the plots you land on, own a whole city to build flats, and collect rent from everyone who stops on your street. The last player with money wins, or the richest after 80 rounds.",
    howTo: ["Roll two dice and move. Buy any plot nobody owns.", "Land on someone's plot and pay them rent.", "Own every plot in a city to build flats; flats raise the rent.", "Pass Start to collect your salary. Market and Fortune squares draw a card.", "Run out of money and you're out. Last landlord standing wins, or the richest after 80 rounds.", "Stuck? Nana, free and built in, suggests a play from what you can see and explains the computer's moves. Switch her off any time."],
    players: "You vs 3 computer players",
    shots: STAGES,
  },
  {
    slug: "ncho", path: "/arcade/ncho", name: "Ncho", kicker: "Board", headline: ["Sow", "and gather."],
    blurb: "The Igbo seed game: relay-sow, make 4, conquer houses. 2 or 4 players.",
    description: "Ncho (also Nchokoto or Nchokoroto, by dialect) is Igbo mancala, cousin of Ayo and Oware. Sow seeds round the board, keep going from wherever your last seed lands, take the 4s you make, and win your opponent's holes (houses) over a number of rounds you choose. Played on a board of two rows of 6 holes, one against the computer or four round the board.",
    howTo: ["Each player owns the holes (houses) on their row, 4 seeds in each, and has a store for captured seeds. Your holes have green rings, the computer's amber.", "Pick up all the seeds from one of your holes and sow them one by one, anticlockwise, round and round. No hole is skipped and seeds never go in a store.", "Relay sowing: if your last seed lands in an empty hole, your turn ends. If it makes exactly 4, you take those 4, on either side, and your turn ends. Otherwise lift all the seeds from that hole and keep sowing.", "Any hole that reaches exactly 4 on the way, before the last seed, goes straight to that hole's owner, whoever is sowing.", "The last 8: when only 8 seeds are left on the board, whoever takes the next 4 takes all 8, and the round ends. You can win them on your opponent's row too.", "A round ends when the player to move has no seeds in their holes. Each of you adds the seeds in your holes to your store, then refills your holes with 4 each. A hole you can't fill is conquered by your opponent, and conquered holes are theirs to play next round.", "Choose 3, 5 or 7 rounds, or play until one side has every house. Most houses wins, and the player with fewer houses starts the next round. When the computer starts, the round begins by itself after a moment.", "4 players: you and three computers, 3 holes each and half an end store each. Turns go round the way the seeds go. A 4 on the way still goes to that hole's owner. Holes a player can't fill go to whoever has most seeds to spare. Lose all your houses and you're out; the last one with houses wins.", "Stuck? Nana, free and built in, lights up the hole she'd sow and says why, and explains each computer move. Switch her off any time."],
    players: "You vs the computer, or you vs 3 computer players",
    shots: LEVELS,
  },
  {
    slug: "akahausa", path: "/arcade/akahausa", name: "Ncho Aka-Hausa", kicker: "Board", headline: ["The other", "way round."],
    blurb: "Ncho the other way round: relay-sow clockwise against a sharper computer.",
    description: "Aka-Hausa is Ncho played the reverse way. The rules are exactly the same, relay sowing, taking 4s and conquering houses over the rounds you choose, but the seeds go round clockwise, so everything you know about the board turns around, and the computer thinks further ahead at every level.",
    howTo: ["The same board: each player owns a row of holes (houses) with 4 seeds in each, and a store. Your holes have green rings, the computer's amber.", "Pick up all the seeds from one of your holes and sow them one by one, clockwise, round and round, never skipping a hole.", "Relay sowing: last seed in an empty hole ends your turn; making exactly 4 lets you take them, on either side, and ends your turn; anything else, lift all the seeds there and keep sowing.", "Any hole that reaches exactly 4 on the way, before the last seed, goes straight to that hole's owner.", "The last 8: when only 8 seeds are left on the board, whoever takes the next 4 takes all 8, and the round ends. You can win them on your opponent's row too.", "When the player to move has no seeds in their holes, the round ends: count your seeds, refill your holes with 4 each, and any hole you can't fill is conquered by your opponent.", "Choose 3, 5 or 7 rounds, or play until one side has every house. Most houses wins, and the player with fewer houses starts the next round. When the computer starts, the round begins by itself after a moment.", "4 players: you and three computers, 3 holes each and half an end store each. Turns go round clockwise, the way the seeds go. Lose all your houses and you're out; the last one with houses wins.", "Stuck? Nana, free and built in, lights up the hole she'd sow and says why, and explains each computer move. Switch her off any time."],
    players: "You vs the computer, or you vs 3 computer players",
    shots: LEVELS,
  },
  {
    slug: "chess", path: "/arcade/chess", name: "Chess", kicker: "Board", headline: ["Your", "move."],
    blurb: "The full game against the computer, three levels.",
    description: "The full game of chess against the computer, with castling, en passant and promotion. Pick a level, play white or black, and see the moves you can make when you tap a piece.",
    howTo: ["Tap a piece to see where it can go, then tap a square.", "Checkmate the other king to win. Stalemate is a draw.", "Pawns promote when they reach the far side.", "Pick a level: easy, medium or hard.", "Stuck? Nana, free and built in, shows you what she'd play and explains the computer's moves. Switch her off any time."],
    players: "You vs the computer",
    shots: LEVELS,
  },
  {
    slug: "draughts", path: "/arcade/draughts", name: "Draughts", kicker: "Board", headline: ["Jump", "and crown."],
    blurb: "African 10×10 or English 8×8: forced jumps, flying kings.",
    description: "Draughts played the African way by default, on the 10×10 board with 20 pieces each: men take backwards, kings fly the length of the board, and you must take the most you can. Prefer a smaller board? Play African rules on 8×8, or English draughts.",
    howTo: ["Pick African 10×10, African 8×8 or English 8×8. Pieces step one square diagonally forward onto dark squares.", "If you can jump, you must, and keep jumping while you can. African rules: men may also jump backwards, and you must take the most pieces you can.", "Reach the far row to become a king. African kings fly any distance along a clear diagonal and capture from afar; English kings move one square either way.", "African rules: a man is only crowned if its move ends on the far row. English rules: reaching it crowns and ends the move.", "Take every piece, or leave the other player with no move, to win. 40 moves each without a capture is a draw (you can switch this off).", "Stuck? Nana, free and built in, shows you what she'd play and explains the computer's moves. Switch her off any time."],
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
