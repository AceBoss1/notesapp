# Discount codes, referrals and affiliates

> Status: **built (30 October 2026): discount codes in v0.101.0, referral links and affiliates in v0.102.0, codes on plans and referral codes in v0.103.0, coupons and Nana's pick in v0.104.0** (§8). One discount engine on the server, used by #NotesApp
> for its own products and by every publisher for theirs; referral links and affiliates sit on top of it.

## 1. What's decided

| Question | Decision |
|---|---|
| A referred friend's discount | **The first month free**, with a card added at the start and billed from the second month, so every referral pays for at least one month before anyone is rewarded (§3) |
| The referrer's reward | **Cash**, or **NotesApp Credit with an extra bonus** if they choose Credit |
| Partner (affiliate) rate on #NotesApp plans | **20% of each plan payment for 12 months** |
| Commission when a code is used | Worked out on the **discounted price** (what the buyer actually paid) |
| Publisher discount codes | On **every plan**, Free Basic included |
| Who can be an affiliate | **Any member with a verified email** |

| The bonus for taking NotesApp Credit instead of cash | **+10%** |
| The minimum cash payout | **₦2,000** (Credit: any amount) |
| A monthly cap on rewarded referrals | **None.** The other rules in §6 do the guarding instead, and admin watches for unusual patterns |

## 2. How plans are billed today (what this builds on)

From `lib/tier-billing.ts` and `lib/tiers.ts`:

- **Monthly** (default Pro ₦5,000, Business ₦15,000): a Paystack subscription that charges the saved card every month.
- **Annual** (default Pro ₦50,000, Business ₦150,000, two months cheaper than paying monthly): **paid once, up front, for the year**,
  and the same Paystack subscription **renews it once a year** on the saved card. A year counts as 366 days.
- Every renewal comes back by webhook and moves `currentPeriodEnd` on; a failed renewal gets 3 days' grace before the account
  drops back to Free Basic. Cancelling stops the next renewal; the plan stays until the end of the time already paid for.
- Admin can change the prices (`/admin/pricing`); the figures above are the defaults.
- Separately, a 15-day free trial of each paid plan is offered once per plan (`lib/trials.ts`).

## 3. A referred friend's first month (how "first month off, card bills at least one month" works)

- **Monthly plan:** the friend adds a card (Paystack saves it with a small check that's returned), pays ₦0 today, and the
  subscription's first charge is set for the day the free month ends. From then on it's an ordinary monthly plan.
- **Annual plan:** the friend gets one month's value off the first year (Pro: ₦50,000 − ₦5,000 = **₦45,000**), billed once up
  front. The card is billed straight away, so the rule is met on day one.
- **The referrer is paid only after the friend's first real payment has gone through and the usual hold has passed** (the same
  hold as publisher payouts). If the friend cancels during the free month, they keep the free month but nobody is paid.
- **No stacking:** the free referral month replaces the 15-day trial for that plan.
- **Not for:** someone who has paid for a plan before, children and teen-mode accounts, or yourself (§6).

## 4. The discount engine

A code (`LAUNCH50`, `ADA20`):

- **Gives** a percentage off, a fixed amount off, or extra free days.
- **Applies to** chosen products, or one item.
- **Is limited by** total uses, uses per member, an end date, a minimum order, first purchase only, or new members only.
- **Rules:** one code per order; paying from the wallet still works.

Who makes codes:

- **#NotesApp (admin):** plans, add-ons (Send-Na, inventory), boosts, Nana credit, Exam Prep packs, merch.
- **Publishers (every plan):** their own shop items, courses, certificates and booked sessions, from their dashboard. A discount
  comes out of the publisher's own price; #NotesApp's commission is worked out on what the buyer actually paid.

How it stays safe:

- **The server works out the price.** The checkout already checks that the amount paid matches the expected price
  (`pricePaidKobo` in `lib/payments.ts`); the code becomes part of that expected price.
- **Limits are counted in the same transaction as the payment**, so the last use can't be taken twice.
- **Guessing codes is rate-limited.**
- **Receipts and invoices** show the price, the discount and what was paid.
- **Plans:** Paystack plans don't take coupons, so a plan discount is the first charge at the discounted price on the saved card,
  then the normal plan from the next period. No "forever" discounts on plans.

## 5. Referral links and affiliates

**Every verified member gets:**

- A link, `naapp.tech/r/<username>`, and a short code (`ADA20`).
- A link is remembered for 30 days. A code typed at checkout wins over a link clicked earlier. Sign-up records who referred the
  new member.

**What they earn:**

| Who they bring | What the friend gets | What they earn |
|---|---|---|
| A new member who takes a #NotesApp plan | First month free (§3) | 20% of each plan payment for 12 months |
| A buyer of a publisher's course or product (publisher affiliates) | The publisher's code, if any | The percentage the publisher sets on that product, taken from the publisher's share |

**Worked example (a publisher's course):**

- Course ₦20,000; a 10% code makes it **₦18,000**.
- #NotesApp's commission (15% in this example; the real rate depends on the plan and product) is worked out on the ₦18,000:
  **₦2,700**.
- The affiliate's 20%: **₦3,600**, from the publisher's share.
- The publisher receives **₦11,700**.

**How earnings are paid:**

- Earnings wait in the ledger until the hold passes, and are reversed if the sale is refunded.
- **Cash:** paid out through Paylony (Paystack as the backup) once they reach **₦2,000**.
- **Or NotesApp Credit with a 10% bonus:** any amount, straight into the wallet (₦1,000 earned becomes ₦1,100 of Credit).

## 6. Stopping abuse

- **No self-referral:** blocked when the two accounts share a device, a payout bank account or a card.
- **No commission on your own purchases.**
- **Rewards only after** a verified email and a payment that has gone through and passed the hold.
- **No monthly cap** (the owner's decision): instead, admin is alerted when one referrer's rewards jump in a week, and can hold
  them for review before they're paid.
- **Not for children or teen-mode accounts** (as in Notes Life).
- **Publishers can pause a leaked code**; admin sees unusual patterns (many sign-ups from one device, codes on coupon sites).

## 7. Order of work

1. **The discount engine:** publisher codes and #NotesApp campaign codes on one-off purchases; a dashboard for each code (uses,
   revenue, discount given).
2. **Referral links:** sign-up attribution, the free first month on plans (§3), rewards in cash or Credit.
3. **Affiliates:** the 20%-for-12-months programme on plans, publisher affiliates, payouts.
4. **Later:** codes in shillings and cedi (Kenya, then Ghana), and bulk codes for schools and organisations.

## 8. What was built (v0.101.0, v0.102.0)

- **Links:** `/r/<username>` (optionally `?to=/shop/<id>` or `/academy/<slug>`) remembers the referrer for 30 days in an httpOnly
  `na_ref` cookie. Sign-up (and the Referrals page, for Google sign-ups) records it in a private `referrals/{uid}` doc, only for an
  account a week old at most that has never paid for a plan. A referrer must have a verified email and not be suspended, a teen or a kid.
- **The friend's first plan:** card only. Monthly: a ₦100 card check now, refunded once Paystack's subscription is created on that
  card to start when the free month ends. Yearly: the year less one month, paid now; the yearly plan starts a year on. If Paystack
  refuses, the friend keeps the period and `tierSubscriptions.subscriptionError` says so.
- **Plan earnings:** 20% of each real plan payment (not the card check) for 12 months from the first, written after the payment.
- **Affiliates:** a publisher sets a share (1 to 50%) per product in `affiliateOffers`; at checkout the share is worked out on what the
  buyer pays (after any code) and taken out of the publisher's ledger net; never on your own purchase or your own product.
- **Holds and payouts:** 7 days (14 for delivered shop items). Cash from ₦2,000 becomes an `affiliate` ledger entry that the usual
  payout run sends; Credit (any amount) adds 10% as Bonus Credits. A refund reverses earnings not yet taken out.
- **No cap:** a week at ₦50,000 or more and 3× the member's usual week is flagged once a week (email to support, `/admin/referrals`),
  where Finance or Growth can hold that member's earnings for review.
- **Codes on plans (v0.103.0):** a #NotesApp code with the "Plans (first payment)" target takes its discount off the first month
  or year, charged without a Paystack plan; `startReferralSubscription` then starts the plan on that card for the period's end
  (`tierSubscriptions.couponFirst`), and never refunds it (only a friend's ₦100 card check is refunded). A code replaces a friend's
  free month (one code per order). Plan earnings are 20% of what was actually paid.
- **Referral codes (v0.103.0):** a member's code is their username. Typed at a plan's checkout (or "Apply"), a code that isn't
  #NotesApp's is tried as a referral code (`referralByCode`), which records the referral the same way the link does; the first
  referral recorded wins.
- **Coupons (v0.104.0):** a code can be shown in its owner's shop (`showInShop`; for #NotesApp's codes, offered at its checkouts),
  shared as a card (`/coupon/<username>/<CODE>`, picture at `/api/coupons/card`), saved by buyers (`savedCoupons`, My coupons), and
  shared by affiliates as their own (`allowAffiliates`: `<USERNAME>-<CODE>` gives the same discount and makes that member the sale's
  affiliate, ahead of a link). At every checkout `bestCoupon` (Nana's pick) applies the coupon that takes the most off, from the
  buyer's saved ones and the ones on show; the buyer can remove it. A store's code only works in its store: another store's code (or
  a #NotesApp code in a store) says so.
- **Not yet:** codes in shillings and cedi, and bulk codes for schools and organisations (§7, step 4).
