// #NotesApp emoji packs: one colour, maroon crimson by Day and warm ivory by Night (components/NotesAppEmoji.tsx, `.na-emoji` in
// app/globals.css). Each is typed into a message as a short code, like :x-talking-drum: or :x-grin:, and drawn inside #NotesApp:
// - Afro culture: our own line drawings (lib/africa-drawings.ts);
// - Flags: in their own colours (Noto Color Emoji), since a flag in one colour isn't that flag;
// - the rest: everyday emojis drawn in one colour with Google's Noto Emoji font (open licence, OFL), loaded in app/layout.tsx.
// Afro culture, Faces and Flags are free; the other packs come with Pro, Business and Enterprise (checked when a message is sent).
import { AFRICA_DRAWINGS } from "./africa-drawings";
import type { AccountTier } from "./users";
import { COUNTRIES, flagCode, flagOf } from "./countries";

export type PackEmoji = { code: string; label: string; drawing?: string; glyph?: string; flag?: boolean };
export type EmojiPack = { id: string; name: string; free: boolean; emojis: PackEmoji[] };

const kebab = (s: string) => s.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();

const CULTURE: [string, string][] = [
  ["talkingDrum", "Talking drum"], ["djembe", "Djembe"], ["kora", "Kora"], ["shekere", "Shekere"], ["ogene", "Ogene (gong)"], ["agogo", "Agogo (two-piece gong)"],
  ["nokHead", "Nok head"], ["nokFigure", "Nok figure"], ["beninHead", "Benin bronze head"], ["idiaMask", "Queen Idia mask"], ["igboUkwuVase", "Igbo-Ukwu bronze vase"],
  ["lantern", "Lantern"], ["adinkrahene", "Adinkrahene"], ["sankofa", "Sankofa"], ["stool", "Stool"], ["kente", "Kente"], ["mudcloth", "Mud cloth"], ["comb", "Comb"],
  ["cowries", "Cowries"], ["pot", "Clay pot"], ["mortar", "Mortar and pestle"], ["jollofPot", "Pot of jollof"], ["plantain", "Plantain"], ["baobab", "Baobab"], ["palm", "Palm tree"],
  ["danfo", "Danfo"], ["keke", "Keke"], ["naira", "Naira"], ["pos", "POS"], ["africa", "Africa"], ["nigeria", "Nigeria"], ["ghana", "Ghana"], ["kenya", "Kenya"],
  ["southAfrica", "South Africa"], ["egypt", "Egypt"],
];

// U+FE0F asks for the coloured picture, which would skip the one-colour font, so it is left off.
const glyphs = (list: [string, string, string][]): PackEmoji[] => list.map(([slug, glyph, label]) => ({ code: `:x-${slug}:`, glyph: glyph.replace(/\uFE0F/g, ""), label }));

export const EMOJI_PACKS: EmojiPack[] = [
  {
    id: "culture", name: "Afro culture", free: true,
    emojis: CULTURE.map(([key, label]) => ({ code: `:x-${kebab(key)}:`, drawing: key, label })),
  },
  {
    id: "faces", name: "Faces", free: true,
    emojis: glyphs([
      ["grin", "😀", "Grin"], ["beam", "😁", "Beaming"], ["laugh", "😆", "Laughing"], ["sweat-smile", "😅", "Sweat smile"], ["rofl", "🤣", "Rolling with laughter"],
      ["joy", "😂", "Tears of joy"], ["smile", "🙂", "Smile"], ["upside-down", "🙃", "Upside down"], ["wink", "😉", "Wink"], ["blush", "😊", "Blush"],
      ["halo", "😇", "Halo"], ["hearts", "🥰", "Hearts"], ["heart-eyes", "😍", "Heart eyes"], ["star-struck", "🤩", "Star-struck"], ["kiss", "😘", "Kiss"],
      ["yum", "😋", "Yum"], ["tongue", "😜", "Tongue out"], ["zany", "🤪", "Zany"], ["money", "🤑", "Money mouth"], ["hug", "🤗", "Hug"],
      ["oops", "🤭", "Oops"], ["shh", "🤫", "Shh"], ["thinking", "🤔", "Thinking"], ["zip", "🤐", "Zipped"], ["raised-brow", "🤨", "Raised eyebrow"],
      ["neutral", "😐", "Neutral"], ["smirk", "😏", "Smirk"], ["eye-roll", "🙄", "Eye roll"], ["relieved", "😌", "Relieved"], ["sleepy", "😴", "Sleeping"],
      ["cool", "😎", "Cool"], ["nerd", "🤓", "Nerd"], ["party", "🥳", "Party"], ["pleading", "🥺", "Pleading"], ["cry", "😢", "Crying"],
      ["sob", "😭", "Sobbing"], ["scream", "😱", "Scream"], ["angry", "😠", "Angry"], ["mind-blown", "🤯", "Mind blown"], ["yawn", "🥱", "Yawn"],
    ]),
  },
  {
    id: "summer", name: "Summer", free: false,
    emojis: glyphs([
      ["sun-face", "🌞", "Sunny"], ["beach", "🏖️", "Beach"], ["island", "🏝️", "Island"], ["wave", "🌊", "Wave"], ["surf", "🏄", "Surfing"],
      ["swim", "🏊", "Swimming"], ["umbrella", "⛱️", "Beach umbrella"], ["sunglasses", "🕶️", "Sunglasses"], ["shell", "🐚", "Shell"], ["crab", "🦀", "Crab"],
      ["dolphin", "🐬", "Dolphin"], ["fish", "🐠", "Fish"], ["coconut", "🥥", "Coconut"], ["pineapple", "🍍", "Pineapple"], ["watermelon", "🍉", "Watermelon"],
      ["ice-cream", "🍦", "Ice cream"], ["drink", "🍹", "Cool drink"], ["boat", "⛵", "Boat"], ["ship", "🚢", "Ship"], ["plane", "✈️", "Plane"],
      ["luggage", "🧳", "Luggage"], ["camera", "📷", "Camera"], ["camping", "🏕️", "Camping"], ["volcano", "🌋", "Mountain"], ["sunrise", "🌅", "Sunrise"],
      ["thermometer", "🌡️", "Hot day"], ["palm-emoji", "🌴", "Palm"],
    ]),
  },
  {
    id: "spooky", name: "Spooky", free: false,
    emojis: glyphs([
      ["pumpkin", "🎃", "Pumpkin"], ["ghost", "👻", "Ghost"], ["skull", "💀", "Skull"], ["bat", "🦇", "Bat"], ["spider", "🕷️", "Spider"],
      ["web", "🕸️", "Web"], ["black-cat", "🐈‍⬛", "Black cat"], ["moon", "🌙", "Moon"], ["crystal-ball", "🔮", "Crystal ball"], ["candle", "🕯️", "Candle"],
      ["coffin", "⚰️", "Coffin"], ["zombie", "🧟", "Zombie"], ["vampire", "🧛", "Vampire"], ["mage", "🧙", "Wizard"], ["alien", "👽", "Alien"],
      ["robot", "🤖", "Robot"], ["ogre", "👹", "Ogre"], ["clown", "🤡", "Clown"], ["owl", "🦉", "Owl"], ["raven", "🐦‍⬛", "Raven"],
      ["lollipop", "🍭", "Lollipop"], ["candy", "🍬", "Sweet"], ["leaf", "🍂", "Leaves"], ["dagger", "🗡️", "Dagger"], ["eye", "👁️", "Eye"],
      ["tombstone", "🪦", "Tombstone"], ["shield", "🛡️", "Shield"],
    ]),
  },
  {
    id: "celebrate", name: "Celebrate", free: false,
    emojis: glyphs([
      ["tada", "🎉", "Party popper"], ["confetti", "🎊", "Confetti"], ["balloon", "🎈", "Balloon"], ["gift", "🎁", "Gift"], ["cake", "🎂", "Birthday cake"],
      ["trophy", "🏆", "Trophy"], ["medal", "🏅", "Medal"], ["crown", "👑", "Crown"], ["ring", "💍", "Ring"], ["champagne", "🍾", "Champagne"],
      ["cheers", "🥂", "Cheers"], ["fireworks", "🎆", "Fireworks"], ["sparkles", "✨", "Sparkles"], ["star", "⭐", "Star"], ["dance", "💃", "Dancing"],
      ["music", "🎶", "Music"], ["mic", "🎤", "Mic"], ["clap", "👏", "Clapping"], ["raise", "🙌", "Hands up"], ["heart", "❤️", "Heart"],
      ["fire", "🔥", "Fire"], ["hundred", "💯", "Hundred"], ["graduate", "🎓", "Graduation"], ["ticket", "🎟️", "Ticket"], ["money-bag", "💰", "Money bag"],
      ["rocket", "🚀", "Rocket"], ["handshake", "🤝", "Deal"],
    ]),
  },
];

// Flags of every African country and the places our members write about most (lib/countries.ts), drawn in their own colours.
EMOJI_PACKS.splice(2, 0, {
  id: "flags", name: "Flags", free: true,
  emojis: COUNTRIES.map((c) => ({ code: flagCode(c.code), glyph: flagOf(c.code), label: `Flag: ${c.name}`, flag: true })),
});

export const PACK_EMOJI: Record<string, PackEmoji & { pack: string }> = Object.fromEntries(
  EMOJI_PACKS.flatMap((p) => p.emojis.map((e) => [e.code, { ...e, pack: p.id }])),
);
export const drawingOf = (e: PackEmoji) => (e.drawing ? AFRICA_DRAWINGS[e.drawing] : undefined);

// Which packs a member can send from. The paid packs come with Pro and above.
const PAID_TIERS: AccountTier[] = ["pro", "business", "enterprise"];
export const unlocksPacks = (tier: AccountTier | undefined) => !!tier && PAID_TIERS.includes(tier);
export const packUnlocked = (pack: EmojiPack, tier: AccountTier | undefined) => pack.free || unlocksPacks(tier);

// The first emoji in some text from a pack this member hasn't unlocked (null if none), so the server can say which pack to unlock.
export function lockedPackIn(text: string, tier: AccountTier | undefined, find: (text: string) => string[]): EmojiPack | null {
  if (unlocksPacks(tier) || !text.includes(":x-")) return null;
  for (const code of find(text)) {
    const e = PACK_EMOJI[code];
    if (!e) continue;
    const pack = EMOJI_PACKS.find((p) => p.id === e.pack)!;
    if (!pack.free) return pack;
  }
  return null;
}
