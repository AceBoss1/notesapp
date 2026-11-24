# 🚪 Homepage doors, and what a trial kept you

From Victory Adugbo's external GTM review (Nov 2026) and the owner's notes on 24 Nov 2026. **Status: mockups, waiting for the owner's
approval.** Nothing is built yet.

## Why

- The homepage shows 20+ features to everyone. A coach can't see in ten seconds that #NotesApp is for them. Once signed in, each member
  already gets a dashboard made for them; the homepage should show that before they sign up.
- Claims need proof. We have real figures (Admin → Traction) and two reference customers, but no numbers or words from them on the page.
- The owner chose not to put a commission calculator on the pricing page (people upgrade when they are ready, and each upgrade lowers our
  commission). The honest place for that maths is **after a member has tried a plan**, with their own payments.
- The gold badge is free on Business and Enterprise; the pricing page should say so.

## 1. A door for each audience

Mockups: [homepage-doors/all-screens.webp](mockups/homepage-doors/all-screens.webp) (HTML: [mockups.html](mockups/homepage-doors/mockups.html)).

- The headline stays. Under it, **"Who are you here as?"**: Professionals · Academics & students · SMEs & sellers · Organisations.
- Each door opens `/for/<audience>`: the dashboard that audience gets (a real screenshot with demo data, marked "sample"), one real quote and,
  when it's worth showing, one real number for that group. Signing up from a door starts the member on that dashboard.
- **A strip of real figures**, read from the same numbers as Admin → Traction and rounded down (₦4M+ processed, ₦800k+ paid out,
  10 organisations on 24 Nov 2026), plus "held until delivery".
- **Rule: nothing made up.** Quotes only from real customers, with permission. A slot without one is hidden, never filled with sample text.
- Pricing says **"Gold badge included"** on Business and Enterprise, and points to the free trial instead of a calculator.

## 2. What you kept in your trial

Mockups: [trial-earnings/all-screens.webp](mockups/trial-earnings/all-screens.webp) (HTML: [mockups.html](mockups/trial-earnings/mockups.html)).

- **During a trial** (`lib/trials.ts`, 15 days of Pro or Business): a dashboard card with the running total kept on the plan compared with
  the plan they go back to (`afterTrialTier`).
- **On the last day** (card and email): what they kept on each plan from the same payments, the plan's price, the monthly pace. When it paid,
  "Keep Pro" and "Go back" side by side. When it didn't, **"Free Basic suits you for now"**, with the point where the plan would pay.
- **One nudge only:** when a Free Basic member's last 30 days pass that point, one message with their own number.
- **How we worked it out:** every kind of earning (sessions, subscriptions, gifts, shop items, ad share) at both plans' rates, at the rates
  on the day of each payment, refunds left out. Seen only by the member.
- **Admin → Growth → Trials:** trials ended, paid after, the commission given up in trials against the plan payments that followed, and
  whether members who trialled stay longer (the week-4 view).

The sample figures use the rates in `lib/tiers.ts` (sessions 35% on Free Basic, 25% on Pro). The real card reads the live rates from Admin →
Pricing.

## Decisions for the owner

| Question | Recommendation |
|---|---|
| Which doors | The four above. Hotels and logistics sit under SMEs & sellers. |
| Figures on the homepage | Processed, paid out and organisations, rounded down, read live. Shown only while each is above a floor the owner sets. |
| Quotes | Collected by the owner (or a GTM contractor) from Precheks, ApexGlitz and the paying members, with written permission. |
| The "pays for itself" point | Worked out from the live rates and price, so it moves when Admin → Pricing changes. |
| The nudge | At most one message every 60 days, and none while a member is on a plan. |
