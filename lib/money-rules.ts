// Crypto and stablecoins in the shop and in adverts (the owner, 6 Nov 2026), after the Central Bank of Nigeria's stablecoin and virtual
// asset rules of 5 November 2026: issuing, exchanging, holding or transferring stablecoins and other virtual assets for people in
// Nigeria needs a CBN licence, and paying interest or yield for holding a stablecoin is banned. #NotesApp holds no licence, so:
// - the shop doesn't sell crypto or stablecoins themselves (coins, tokens, P2P trades, "USDT for sale"); books, guides and courses
//   ABOUT crypto stay allowed;
// - an advert for a crypto, stablecoin or virtual-asset service runs only when the advertiser shows a CBN licence or registration for
//   it, and no advert may promise interest, yield or returns for holding coins or tokens.
// The shop pattern is enforced by firestore.rules (validStoreItem: the same two patterns on the title, lower-cased); keep them alike.

// Whole words only, so "Ethiopian coffee" or "a token of love" never match. Built without lookarounds, which Firestore rules' RE2
// lacks: a word sits between the start or a non-letter and a non-letter or the end, and two words share the separator between them.
// Lower-case input.
const COIN_WORDS = "usdt|usdc|rlusd|busd|tether|stablecoins?|bitcoins?|btc|ethereum|solana|crypto|cryptocurrency|cryptocurrencies";
const TRADE_WORDS = "for sale|p2p|exchange|rates?|buy|sell|selling|instant|naira|swap|cash ?out|otc";
const ABOUT_WORDS = "guide|course|book|ebook|class|lesson|training|explained|basics|beginners?|masterclass|tutorial|webinar|handbook";
const word = (w: string) => `(^|.*[^a-z0-9])(${w})([^a-z0-9].*|$)`;
const pair = (a: string, b: string) => `(^|.*[^a-z0-9])(${a})([^a-z0-9]|[^a-z0-9].*[^a-z0-9])(${b})([^a-z0-9].*|$)`;
// The three patterns firestore.rules uses (validStoreItem), printed by tests/money so the rules can be checked against them.
export const LISTING_PATTERNS = { coinThenTrade: pair(COIN_WORDS, TRADE_WORDS), tradeThenCoin: pair(TRADE_WORDS, COIN_WORDS), about: word(ABOUT_WORDS) };
const coinThenTrade = new RegExp(`^${LISTING_PATTERNS.coinThenTrade}$`);
const tradeThenCoin = new RegExp(`^${LISTING_PATTERNS.tradeThenCoin}$`);
const about = new RegExp(`^${LISTING_PATTERNS.about}$`);

// True when a listing's title sells crypto or stablecoins themselves (not a book or course about them).
export function cryptoListing(title: string): boolean {
  const t = title.toLowerCase();
  return (coinThenTrade.test(t) || tradeThenCoin.test(t)) && !about.test(t);
}
export const CRYPTO_LISTING_MESSAGE =
  "#NotesApp doesn't sell crypto or stablecoins (USDT, USDC, Bitcoin and the like) or P2P trades: in Nigeria that needs a Central Bank licence. Books, guides and courses about crypto are fine; if this is one, say so in the title (for example \"… guide\" or \"… course\").";

// What the shop doesn't sell, shown on the add-item form, in the Terms and the help centre.
export const STORE_RULES = [
  "Crypto, stablecoins or tokens themselves (USDT, USDC, Bitcoin and the like), P2P trades or exchange services. Books, guides and courses about them are fine.",
  "Anything illegal, stolen, counterfeit or unsafe, and anything you don't have the right to sell.",
  "Listings that send buyers to another checkout: everything sells through #NotesApp checkout.",
];

// For admins reviewing an advert: what in its words needs a closer look. Never decides on its own.
const AD_CRYPTO = new RegExp(word(`${COIN_WORDS}|virtual assets?|defi|staking|airdrops?|nfts?|web3|blockchain|tokens?`));
const AD_YIELD = /(\d+(\.\d+)?\s?%\s?(apy|apr|daily|weekly|monthly|a (day|week|month)|returns?|interest|profit))|\b(apy|apr|guaranteed returns?|passive income|earn interest|yield|double your|roi)\b/i;
export function adFlags(text: string): { crypto: boolean; yieldPromise: boolean } {
  const t = text.toLowerCase();
  return { crypto: AD_CRYPTO.test(t), yieldPromise: AD_YIELD.test(t) };
}
