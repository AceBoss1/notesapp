// Nana for Ace of Spades (owner, 21 Nov 2026: "a free Nana for arcade ... where Nana suggests moves or analyze opponent moves").
// Pure: no React.
//
// Free, so no AI service: the tip is the computer players' own bid and card choice (computerBid / computerPlay) made from your seat.
// Nana must never give away what you can't see, so she works on a copy of the game with everyone else's hand emptied: only your
// hand, the bids, the cards on the table and the cards already played are left. The computer logic only looks at its own seat's
// hand, so the tip is the same, and a test proves shuffling the other hands never changes it.
import { listText, type NanaTake, type NanaTip } from "./nana";
import {
  SEAT_NAME, SUIT_NAME, cardName, computerBid, computerPlay, legalCards, sameCard, teamOf, trickLeader,
  type Card, type Seat, type SpadesMove, type SpadesState, type Suit,
} from "./spades";

export type SpadesHint = { type: "bid"; bid: number } | { type: "play"; card: Card };

const NUMBER_WORD = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen"];
const count = (n: number) => NUMBER_WORD[n] ?? String(n);
const one = (suit: Suit) => SUIT_NAME[suit].replace(/s$/, ""); // "heart", for "the highest heart"
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** What a seat can see: its own hand and everything on the table. Every other hand is emptied. */
export function visibleSpades(s: SpadesState, seat: Seat = 0): SpadesState {
  return { ...s, hands: s.hands.map((h, i) => (i === seat ? h.slice() : [])) };
}

// The highest card of its suit still out, judged only from your own hand and the cards played (same idea as the engine's isBoss).
function isBoss(card: Card, s: SpadesState, seat: Seat): boolean {
  for (let r = card.rank + 1; r <= 14; r += 1) {
    const seen = s.played.some((c) => c.suit === card.suit && c.rank === r) || s.hands[seat].some((c) => c.suit === card.suit && c.rank === r);
    if (!seen) return false;
  }
  return true;
}

function bidWhy(hand: Card[], bid: number, partnerBid: number | null): string {
  const reasons: string[] = [];
  const spades = hand.filter((c) => c.suit === "S");
  const aces = hand.filter((c) => c.rank === 14).map(cardName);
  if (aces.length) reasons.push(`you hold the ${listText(aces)}`);
  const kings = (["H", "C", "D"] as Suit[]).filter((suit) => {
    const cards = hand.filter((c) => c.suit === suit);
    return cards.some((c) => c.rank === 13) && cards.length >= 2;
  });
  if (kings.length) reasons.push(`your king${kings.length > 1 ? "s" : ""} of ${listText(kings.map((x) => SUIT_NAME[x]))} ${kings.length > 1 ? "are" : "is"} covered`);
  if (spades.length >= 4) reasons.push(`${count(spades.length)} spades to trump with`);
  const voids = (["H", "C", "D"] as Suit[]).filter((suit) => !hand.some((c) => c.suit === suit));
  if (voids.length && spades.length >= 2) reasons.push(`no ${listText(voids.map((x) => SUIT_NAME[x]))}, so you can trump early`);
  const said = reasons.length > 1 ? `${reasons[0]}, plus ${listText(reasons.slice(1))}` : reasons[0];
  const base = reasons.length ? `${said}, so bid on ${bid === 1 ? "one trick" : `${count(bid)} tricks`}` : "your hand is thin, so bid low and help your partner";
  const partner = partnerBid !== null ? ` Partner bid ${partnerBid}, so your team aims for ${partnerBid + bid}.` : "";
  return `${cap(base)}.${partner}`;
}

function playWhy(s: SpadesState, card: Card): string {
  const seat: Seat = 0;
  const team = teamOf(seat);
  const teamBid = (s.bids[team] ?? 0) + (s.bids[team + 2] ?? 0);
  const need = teamBid - (s.tricksWon[team] + s.tricksWon[team + 2]);
  const legal = legalCards(s, seat);
  if (legal.length === 1) return `It's the only card you're allowed to play.`;
  if (s.trick.length === 0) {
    if (card.suit !== "S" && isBoss(card, s, seat)) return `The ${cardName(card)} is the highest ${one(card.suit)} still out, so it should win the trick.`;
    if (card.suit === "S" && isBoss(card, s, seat)) return `The ${cardName(card)} is the top spade still out${need > 0 ? `, and your team still needs ${count(need)} trick${need === 1 ? "" : "s"}` : ""}.`;
    return `Lead low from your longest suit, ${SUIT_NAME[card.suit]}, so partner can win it or the high cards get drawn out.`;
  }
  const led = s.trick[0].card.suit;
  const leading = trickLeader(s.trick);
  const wins = trickLeader([...s.trick, { seat, card }]).seat === seat;
  const last = s.trick.length === 3;
  const follows = card.suit === led;
  if (teamOf(leading.seat) === team && !wins) {
    return `Partner is winning this trick with the ${cardName(leading.card)}, so ${follows ? "play low" : `throw away your ${cardName(card)}`} and keep your good cards.`;
  }
  if (wins) {
    if (!follows && card.suit === "S") return `You have no ${SUIT_NAME[led]}, so trump with the ${cardName(card)} to take the trick.`;
    if (teamOf(leading.seat) === team) return `Partner's ${cardName(leading.card)} could still be beaten, and your ${cardName(card)} can't be, so make sure of the trick.`;
    if (last) return `It's the cheapest card that takes the trick.`;
    if (isBoss(card, s, seat)) return `The ${cardName(card)} can't be beaten in ${SUIT_NAME[card.suit]}, so the trick is yours.`;
    return `It's the cheapest card that beats the ${cardName(leading.card)}.`;
  }
  return follows
    ? `You can't beat the ${cardName(leading.card)}, so play your lowest ${one(led)} and save the good cards.`
    : `You have no ${SUIT_NAME[led]} and can't win this one, so throw away your ${cardName(card)}.`;
}

export function spadesTip(state: SpadesState): { tip: NanaTip; highlight: SpadesHint } | null {
  if (state.turn !== 0) return null;
  const s = visibleSpades(state, 0);
  if (s.phase === "bid") {
    const bid = computerBid(s.hands[0]);
    return { tip: { move: `bid ${bid}`, why: bidWhy(s.hands[0], bid, s.bids[2]) }, highlight: { type: "bid", bid } };
  }
  if (s.phase !== "play" || s.hands[0].length === 0) return null;
  const card = computerPlay(s);
  return { tip: { move: `your ${cardName(card)}`, why: playWhy(s, card) }, highlight: { type: "play", card } };
}

const nameOf = (seat: Seat) => (seat === 0 ? "you" : SEAT_NAME[seat]);

/** Nana's take on a computer seat's move (West, Partner or East), from what's on the table. */
export function spadesTake(before: SpadesState, move: SpadesMove, after: SpadesState): NanaTake | null {
  const seat = before.turn;
  if (seat === 0 || move.type === "next") return null;
  const who = SEAT_NAME[seat];
  const ours = teamOf(seat) === 0;
  if (move.type === "bid") {
    const mate = (seat + 2) % 4;
    const mateBid = after.bids[mate];
    const total = mateBid === null ? "" : ours ? ` Your team needs ${move.bid + mateBid} tricks between you.` : ` East and West need ${move.bid + mateBid} tricks between them.`;
    return { text: `${who} bid ${move.bid}.${total}`, tone: ours ? "fine" : move.bid >= 5 ? "risky" : "fine" };
  }
  const card = move.card;
  const broke = !before.spadesBroken && after.spadesBroken ? " Spades are broken now." : "";
  if (after.trick.length === 0 && after.lastTrick) {
    const plays = after.lastTrick.plays;
    const led = plays[0].card.suit;
    const winner = after.lastTrick.winner;
    const weWin = teamOf(winner) === 0;
    if (winner === seat) {
      const how = card.suit === "S" && led !== "S" ? `trumped with the ${cardName(card)} to take the trick` : `took the trick with the ${cardName(card)}`;
      return { text: `${who} ${how}.${broke}`, tone: weWin ? "good" : "risky" };
    }
    return { text: `${who} played the ${cardName(card)}, and ${winner === 0 ? "you take" : `${nameOf(winner)} takes`} the trick.${broke}`, tone: weWin ? "good" : "fine" };
  }
  if (before.trick.length === 0) {
    return { text: `${who} led the ${cardName(card)}.${broke}${leadAdvice(after, card)}`, tone: "fine" };
  }
  const led = before.trick[0].card.suit;
  const winning = trickLeader(after.trick).seat === seat;
  if (card.suit !== led) {
    const text = card.suit === "S"
      ? `${who} has no ${SUIT_NAME[led]} and trumped with the ${cardName(card)}.${broke}`
      : `${who} has no ${SUIT_NAME[led]} and threw the ${cardName(card)}.`;
    return { text, tone: card.suit === "S" && !ours ? "risky" : "fine" };
  }
  if (winning) return { text: `${who} is winning the trick with the ${cardName(card)}.`, tone: ours ? "good" : "fine" };
  return { text: `${who} played the ${cardName(card)}, too low to win.`, tone: "fine" };
}

// When it's your turn straight after a lead, say whether you can follow (from your own hand only).
function leadAdvice(after: SpadesState, card: Card): string {
  if (after.turn !== 0 || after.phase !== "play") return "";
  const mine = after.hands[0].filter((c) => c.suit === card.suit);
  if (mine.length) {
    const beat = mine.some((c) => c.rank > card.rank);
    return beat ? ` You can beat it in ${SUIT_NAME[card.suit]}.` : ` Follow with a low ${one(card.suit)}.`;
  }
  if (card.suit === "S") return "";
  return after.hands[0].some((c) => c.suit === "S") ? ` You have no ${SUIT_NAME[card.suit]}, so a spade would trump it.` : ` You have no ${SUIT_NAME[card.suit]}: throw away your weakest card.`;
}

/** True when two cards are the same: handy for highlighting the suggested card in your hand. */
export const isHintCard = (hint: SpadesHint | null, card: Card) => hint?.type === "play" && sameCard(hint.card, card);
