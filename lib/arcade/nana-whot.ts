// Nana for Whot (owner, 21 Nov 2026: "a free Nana for arcade ... where Nana suggests moves or analyze opponent moves"). Pure: no React.
//
// Free, so no AI service: the tip is the computer opponent's own choice (computerMove) played from your seat. Nana must never give
// away what you can't see, so she works on a copy of the game where the computer's hand is blank cards (only its size is kept,
// which you can see on the table) and the market is empty. computerMove only reads the size, so the tip comes out the same, and a
// test proves it doesn't change when the computer's cards or the market order do.
import { listText, type NanaTake, type NanaTip } from "./nana";
import { SHAPES, canPlay, computerMove, topCard, type Card, type Shape, type WhotMove, type WhotState } from "./whot";

const NUMBER_WORD = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
const count = (n: number) => NUMBER_WORD[n] ?? String(n);
const plural = (shape: Card["shape"]) => (shape === "whot" ? "Whots" : shape === "cross" ? "crosses" : `${shape}s`);
// "5 of circles", the way people say it at the table (owner's example: "your 5 of circles").
const cardLabel = (c: Card) => (c.shape === "whot" ? "Whot" : `${c.num} of ${plural(c.shape)}`);

/** What you can see: your hand, the pile, the shape asked for, and only how many cards the computer and the market hold. */
export function visibleWhot(s: WhotState, seat: 0 | 1 = 0): WhotState {
  const hands = [[], []] as [Card[], Card[]];
  hands[seat] = s.hands[seat].slice();
  const blank: Card = { shape: "whot", num: 0 };
  hands[seat === 0 ? 1 : 0] = s.hands[seat === 0 ? 1 : 0].map(() => blank);
  return { ...s, hands, market: [] };
}

function bestShape(hand: Card[]): { shape: Shape; n: number } {
  const counts = SHAPES.map((shape) => hand.filter((c) => c.shape === shape).length);
  const n = Math.max(...counts);
  return { shape: SHAPES[counts.indexOf(n)], n };
}

export function whotTip(state: WhotState): { tip: NanaTip; highlight: WhotMove } | null {
  if (state.phase === "over" || state.turn !== 0) return null;
  const s = visibleWhot(state, 0);
  const hand = s.hands[0];
  const move = computerMove(s);
  const oppCards = s.hands[1].length;

  if (move.type === "call") {
    const n = hand.filter((c) => c.shape === move.shape).length;
    const why = n > 0
      ? `you hold ${count(n)} ${n === 1 ? move.shape : plural(move.shape)}, more than any other shape, so you can follow up on your next turn.`
      : "you hold only Whots, so any shape will do.";
    return { tip: { move: `ask for ${plural(move.shape)}`, why: cap(why) }, highlight: move };
  }

  if (move.type === "draw") {
    const top = topCard(s);
    const why = s.pending
      ? `you have no ${s.pending.num} to pass it on, so take the ${count(s.pending.count)} cards and play on.`
      : s.wanted
        ? `nothing in your hand is a ${s.wanted} and you have no Whot, so go to market.`
        : `nothing in your hand matches the ${cardLabel(top)}, so go to market.`;
    return { tip: { move: s.pending ? `pick ${s.pending.count}` : "go to market", why: cap(why) }, highlight: move };
  }

  const card = hand[move.index];
  return { tip: { move: `your ${cardLabel(card)}`, why: cap(playWhy(s, card, hand, oppCards)) }, highlight: move };
}

function playWhy(s: WhotState, card: Card, hand: Card[], oppCards: number): string {
  if (hand.length === 1) return "it's your last card: play it and check up.";
  if (s.pending) return `it passes the Pick ${s.pending.num === 2 ? "Two" : "Three"} on, so the computer picks ${s.pending.count + (card.num === 2 ? 2 : 3)} instead of you.`;
  const rest = hand.filter((c) => c !== card);
  const lastCardNote = oppCards === 1 ? " The computer is on its last card, so make it pick." : oppCards === 2 ? " The computer is down to two cards." : "";
  if (card.shape === "whot") {
    const next = bestShape(rest);
    return next.n > 0 ? `a Whot goes on anything. Then ask for ${plural(next.shape)}, your best shape.` : "a Whot goes on anything, and you have more to follow.";
  }
  const match = s.wanted ? `the computer asked for ${plural(s.wanted)}` : matchText(s, card);
  switch (card.num) {
    case 2: return `Pick Two makes the computer draw two cards, and ${match}.${lastCardNote}`;
    case 5: return `Pick Three makes the computer draw three cards, and ${match}.${lastCardNote}`;
    case 14: return `General Market makes the computer pick one and you play again, and ${match}.${lastCardNote}`;
    case 1: return `Hold On lets you play again straight away, and ${match}.`;
    case 8: return `Suspension makes the computer miss a turn, so you play again, and ${match}.`;
    default: {
      const more = rest.filter((c) => c.shape === card.shape).length;
      const parts = [match];
      if (more > 0) parts.push(`you still hold ${count(more)} more ${more === 1 ? card.shape : plural(card.shape)} to follow`);
      return `${listText(parts)}.`;
    }
  }
}

function matchText(s: WhotState, card: Card): string {
  const top = topCard(s);
  if (card.shape === top.shape) return `it matches the ${plural(card.shape)} on the pile`;
  return `it matches the ${top.num} on the pile`;
}

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** Nana's take on the computer's latest move, from what you can see on the table. */
export function whotTake(before: WhotState, move: WhotMove, after: WhotState): NanaTake | null {
  if (before.turn !== 1) return null; // only the computer's moves get a take
  const yours = after.hands[0];
  if (move.type === "call") {
    const n = yours.filter((c) => c.shape === move.shape).length;
    const whots = yours.filter((c) => c.shape === "whot").length;
    const advice = n > 0 ? `you have ${count(n)}.` : whots > 0 ? "you have none, but a Whot will do." : "you have none, so it's the market for you.";
    return { text: `The computer called Whot and asked for ${plural(move.shape)}: check your ${plural(move.shape)}, ${advice}`, tone: n > 0 || whots > 0 ? "fine" : "risky" };
  }
  if (move.type === "draw") {
    if (before.pending) return { text: `The computer couldn't pass it on and picked ${before.pending.count}. It now holds ${after.hands[1].length} cards.`, tone: "good" };
    return { text: `The computer went to market. It now holds ${after.hands[1].length} cards.`, tone: "good" };
  }
  const card = before.hands[1][move.index];
  if (!card) return null;
  if (after.phase === "over" && after.winner === 1) return { text: "Check up: the computer played its last card. Deal again and get your own back.", tone: "risky" };
  const left = after.hands[1].length;
  const lastCard = left === 1 ? " It's on its last card: hit it with a Pick Two or General Market if you can." : "";
  switch (card.num) {
    case 20: return { text: "The computer played a Whot: it will ask for a shape next.", tone: "fine" };
    case 2:
    case 5: {
      const pick = after.pending?.count ?? (card.num === 2 ? 2 : 3);
      const has = yours.some((c) => c.num === card.num);
      return { text: `The computer played Pick ${card.num === 2 ? "Two" : "Three"}: ${has ? `play your ${card.num} to pass it back` : `you'll pick ${pick}`}.${lastCard}`, tone: has ? "fine" : "risky" };
    }
    case 14: return { text: `General Market: you pick one and the computer plays again.${lastCard}`, tone: "risky" };
    case 1: return { text: `Hold On: the computer plays again.${lastCard}`, tone: "fine" };
    case 8: return { text: `Suspension: you miss a turn while the computer plays again.${lastCard}`, tone: "risky" };
    default: return { text: `The computer played the ${cardLabel(card)}.${lastCard || (canFollow(after) ? " You have a card to match it." : "")}`, tone: left === 1 ? "risky" : "fine" };
  }
}

function canFollow(s: WhotState): boolean {
  return s.phase === "play" && s.turn === 0 && s.hands[0].some((c) => canPlay(s, c));
}
