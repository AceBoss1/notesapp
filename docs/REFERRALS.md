# Discount codes, referrals and affiliates

> Status: **plan, decided by the owner on 30 October 2026; nothing built yet.** One discount engine on the server, used by #NotesApp
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
