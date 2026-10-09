import { articlePath, countMatches, queryWords, searchArticles, type KbArticle } from "./kb";
import { firstName } from "./nana";

// Nana without the AI: she answers from the knowledge base alone. Used when no AI key is set, when the key or its credit runs out, or when
// the AI is briefly down, so the chat never just stops. It finds the best help articles for the question and presents them in a friendly,
// human way with links. It cannot hold a free-form conversation or combine facts; that is what the AI adds. Pure and testable.
const GREET = /^\s*(hi|hello|hey|hiya|howdy|good (morning|afternoon|evening)|how far|sup|yo)\b[\s!,.?]*(nana)?[\s!.?]*$/i;
const THANKS = /\b(thanks|thank you|thx|cheers|appreciate)\b/i;
const PERSON = /\b(talk to (a )?(person|human|someone|agent)|speak (to|with) (a )?(person|human|someone|agent)|real person|human agent|customer (care|service)|call me|representative)\b/i;
const TROUBLE = /\b(refund|chargeback|scam|fraud|hacked|locked out|can'?t (log ?in|sign ?in)|cannot (log ?in|sign ?in)|didn'?t (receive|get)|not received|payment (failed|issue|problem)|money (is )?(missing|gone)|wrong charge|charged twice|double charge|suspended|report (a|an) )\b/i;

const OPENERS = ["Good question!", "Happy to help!", "Sure thing!", "Glad you asked!"];
const pick = <T,>(xs: T[], seed: string) => xs[[...seed].reduce((n, c) => (n + c.charCodeAt(0)) % 9973, 0) % xs.length];

// The part of an article that answers the question: the paragraph with the most of the question's words (with the opening line before it
// for context when it is short), trimmed to about `max` characters. An article that is one paragraph is shown from the start.
function excerpt(body: string, question: string, max = 600): string {
  const paras = body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  if (paras.length <= 1) return trim(paras[0] ?? "", max);
  const ws = queryWords(question);
  const score = (p: string) => countMatches(p, ws);
  let best = 0;
  paras.forEach((p, i) => { if (score(p) > score(paras[best])) best = i; });
  const out = best > 0 && paras[0].length < 260 && score(paras[best]) > 0 ? [paras[0], paras[best]] : [paras[best]];
  return trim(out.join("\n\n"), max);
}
const trim = (text: string, max: number) => (text.length <= max ? text : `${text.slice(0, max).replace(/\s+\S*$/, "")}…`);

export type KbReply = { text: string; handoff: boolean; gap: boolean };

export function kbReply(articles: KbArticle[], question: string, name: string, history: { role: string; content: string }[] = []): KbReply {
  const first = firstName(name);
  const hi = first ? `, ${first}` : "";
  const q = question.trim();
  if (GREET.test(q)) {
    return { text: `Hi${hi}! I'm Nana, your #NotesApp helper. Ask me about plans and prices, payouts, bookings and refunds, selling, badges or organisations, and I'll find the right answer and link. What would you like to know?`, handoff: false, gap: false };
  }
  if (THANKS.test(q) && q.length < 60) {
    return { text: `You're welcome${hi}! Anything else about #NotesApp I can help with?`, handoff: false, gap: false };
  }
  // The topic may sit in the earlier messages ("and what about refunds?"), so a very short question also looks at the one before it.
  const prior = [...history].reverse().find((m) => m.role === "user" && m.content !== q)?.content ?? "";
  // A very short follow-up ("and the price?") leans on the question before it.
  let topic = queryWords(q).length <= 2 && prior ? `${prior} ${q}` : q;
  let found = searchArticles(articles, topic, 4);
  if (!found.length && topic !== q) { topic = q; found = searchArticles(articles, q, 4); }

  const wantsPerson = PERSON.test(q), trouble = TROUBLE.test(q);
  const handoff = wantsPerson || trouble;
  const contact = "[Contact page](/contact)";
  if (!found.length) {
    return {
      text: handoff
        ? `I'm sorry about that${hi}. I'll pass this to the team and they'll follow up on the email you gave. You can also use the ${contact} to add details.`
        : `I couldn't find that in our help articles yet${hi}, and I don't want to guess. You can browse the [Help centre](/help) or ask the team on the ${contact}, and a person will help.`,
      handoff, gap: !handoff,
    };
  }
  const [top, ...more] = found;
  // Team-only articles (slug starts with hub-) have no public page to link to.
  const linkable = (a: KbArticle) => !a.slug.startsWith("hub-");
  const related = more.filter(linkable).slice(0, 2).map((a) => `[${a.title}](${articlePath(a.slug)})`);
  const intro = handoff ? `I'm sorry you're dealing with that${hi}. I've asked the team to follow up on the email you gave. Meanwhile, this may help:` : `${pick(OPENERS, q)} Here's what we have on **${top.title}**:`;
  const text = `${intro}\n\n${excerpt(top.body, topic)}\n\n${linkable(top) ? `Full article: [${top.title}](${articlePath(top.slug)})` : ""}${related.length ? `\n\nYou might also like: ${related.join(" · ")}` : ""}`;
  return { text, handoff, gap: false };
}
