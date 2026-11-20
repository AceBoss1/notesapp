// Notes Arcade: every game, its page, what it is and how to play. The Arcade home (app/(arcade)/arcade/page.tsx) lists these,
// and each game page reads its own entry for the side panel. Screenshots live in public/images/arcade/<slug>.png
// (scripts/arcade-shots.mjs takes them). Every game here is our own build: no other company's names, art or boards.

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
};

export const ARCADE_GAMES: ArcadeGame[] = [
  {
    slug: "snake", path: "/snake", name: "Snake", kicker: "The classics", headline: ["Stay", "hungry."],
    blurb: "Eat, grow, don't bump into yourself.",
    description: "One little snake. A lot of snacks. Steer it round the board, eat to grow longer, and see how long you can keep going before you run into your own tail.",
    howTo: ["Arrow keys or W A S D to steer; the arrows on a phone.", "Each snack is 10 points and makes you longer.", "Hit yourself and the run ends. Pick a speed: chill, classic or fast."],
    players: "One player",
  },
  {
    slug: "ludo", path: "/arcade/ludo", name: "Ludo", kicker: "Board", headline: ["Roll", "home."],
    blurb: "Four colours, one die, race your four seeds home.",
    description: "The race game every Nigerian home knows. Roll the die, bring your seeds out on a six, race them round the board and into your home column. Land on another colour and send it back to its yard.",
    howTo: ["Roll a six to bring a seed out of your yard.", "A six gives you another roll.", "Land on another player's seed to send it back to its yard. Star and start squares are safe.", "Get all four seeds home first to win."],
    players: "You vs 3 computer players",
  },
  {
    slug: "whot", path: "/arcade/whot", name: "Whot", kicker: "Cards", headline: ["Check", "up!"],
    blurb: "Match shape or number, play your specials, empty your hand.",
    description: "The Naija card game of circles, triangles, crosses, squares and stars. Match the card on the pile by shape or number, use your specials to make the other player pick, and be the first to empty your hand.",
    howTo: ["Play a card that matches the top card's shape or number.", "1 Hold on: play again. 2 Pick two. 5 Pick three. 8 Suspension: the other player misses a turn. 14 General market: everyone else picks one.", "20 is Whot: play it on anything, then ask for a shape.", "No card to play? Go to market and pick one.", "First to empty their hand wins."],
    players: "You vs the computer",
  },
  {
    slug: "spades", path: "/arcade/spades", name: "Ace of Spades", kicker: "Cards", headline: ["Spades", "are trumps."],
    blurb: "Bid your tricks, partner up, spades beat everything.",
    description: "A four-player trick-taking game: you and your partner across the table against two computer players. Bid how many tricks you'll take, follow suit when you can, and remember spades are always trumps.",
    howTo: ["Everyone gets 13 cards and bids how many tricks they'll win.", "Follow the suit that was led if you can. If you can't, play anything, including a spade.", "The highest spade wins the trick; with no spades, the highest card of the suit led.", "Spades can't be led until one has been played.", "Make your team's bid: 10 points a trick bid, 1 for each extra. Miss it and lose 10 a trick. First team to 250 wins."],
    players: "You and a partner vs 2 computer players",
  },
  {
    slug: "landlord", path: "/arcade/landlord", name: "Naija Landlord", kicker: "Board", headline: ["Buy the", "street."],
    blurb: "Buy plots across Naija's cities, build, collect rent.",
    description: "Our own property-trading game. Roll round a board of Nigerian neighbourhoods, buy the plots you land on, own a whole city to build flats, and collect rent from everyone who stops on your street. The last player with money wins, or the richest after 80 rounds.",
    howTo: ["Roll two dice and move. Buy any plot nobody owns.", "Land on someone's plot and pay them rent.", "Own every plot in a city to build flats; flats raise the rent.", "Pass Start to collect your salary. Market and Fortune squares draw a card.", "Run out of money and you're out. Last landlord standing wins, or the richest after 80 rounds."],
    players: "You vs 3 computer players",
  },
  {
    slug: "ncho", path: "/arcade/ncho", name: "Ncho", kicker: "Board", headline: ["Sow", "and gather."],
    blurb: "The Igbo seed game: sow, capture, out-count.",
    description: "Ncho (also called Okwe) is the Igbo seed-sowing game played on a board of twelve holes. Pick up the seeds in one of your holes, sow them one by one round the board, and capture when your last seed makes two or three.",
    howTo: ["In the version we play, each side has six holes with four seeds each.", "Pick a hole on your side. Its seeds are sown one per hole, anticlockwise.", "If your last seed lands on the other side and makes 2 or 3, you capture them, and the holes before it that also have 2 or 3.", "You must leave the other player a move if you can.", "When no more moves are possible, the player with the most seeds wins."],
    players: "You vs the computer",
  },
  {
    slug: "chess", path: "/arcade/chess", name: "Chess", kicker: "Board", headline: ["Your", "move."],
    blurb: "The full game against the computer, three levels.",
    description: "The full game of chess against the computer, with castling, en passant and promotion. Pick a level, play white or black, and see the moves you can make when you tap a piece.",
    howTo: ["Tap a piece to see where it can go, then tap a square.", "Checkmate the other king to win. Stalemate is a draw.", "Pawns promote when they reach the far side.", "Pick a level: easy, medium or hard."],
    players: "You vs the computer",
  },
  {
    slug: "draughts", path: "/arcade/draughts", name: "Draughts", kicker: "Board", headline: ["Jump", "and crown."],
    blurb: "Diagonal moves, forced jumps, crown your kings.",
    description: "Draughts on an 8×8 board. Move diagonally forward, jump the other player's pieces to capture them, and reach the far row to crown a king that moves both ways.",
    howTo: ["Pieces move one square diagonally forward onto dark squares.", "If you can jump, you must. Keep jumping while you can.", "Reach the far row to become a king; kings move and jump backwards too.", "Take every piece, or leave the other player with no move, to win."],
    players: "You vs the computer",
  },
];

export function arcadeGame(slug: string): ArcadeGame {
  const g = ARCADE_GAMES.find((x) => x.slug === slug);
  if (!g) throw new Error(`No arcade game ${slug}`);
  return g;
}

// Short paths on arcade.<domain>: arcade.naapp.tech/ludo → /arcade/ludo (middleware.ts).
export const ARCADE_SLUGS = ARCADE_GAMES.filter((g) => g.path.startsWith("/arcade/")).map((g) => g.slug);
