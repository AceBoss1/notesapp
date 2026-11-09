# Payments: who does what

> Status: **decided by the owner, 29 October 2026.** Paystack stays; Paylony takes bank transfers and Tap2Pay; Flutterwave comes with
> the move across Africa, which follows the US company, NotesApp Inc (Delaware), due to be incorporated in about two weeks. Nothing in
> this note changes code by itself; it's the map the next payment work follows.

## 1. The three providers and their jobs

| Provider | Its job | Live today |
|---|---|---|
| **Paystack** | Cards; subscriptions (plans and add-ons, `plan_code`, saved cards `authorization_code`); refunds; split payments and payouts as the **backup** | Yes: checkout, plans, payouts (default provider) |
| **Paylony** | Bank transfers in (a dedicated account number per member for wallet top-ups and payments) and out (publisher payouts); **Tap2Pay** (CardTap) | Partly: CardTap top-ups, Paylony payouts behind the admin switch (`paylonyConfig/main.payoutProvider`); virtual accounts not yet |
| **Flutterwave** | Payments outside Nigeria: Ghana, Kenya (M-Pesa), mobile money, other African currencies and foreign cards | No: comes with the expansion (§4) |

Why this split:

- **Nothing breaks.** Paystack keeps every subscription and saved card; nobody is asked for their card again.
- **Transfers are cheaper than cards** and are how most Nigerians already pay, so Paylony takes them, and Tap2Pay sits with it.
- **Two providers for payouts:** if one is down or slow, the admin switch (and later an automatic one) sends payouts through the
  other. Paystack is the backup because it already pays out today.
- **Flutterwave only where we need it:** it reaches the countries and currencies Paystack and Paylony don't, without moving
  Nigerian payments that already work.

**Paystack transfer OTP (v0.114.0).** With "Confirm transfers before sending" (Transfers OTP) on in the Paystack dashboard, each
payout's `POST /transfer` answers `status: "otp"` and waits; Finance types the emailed code under **Awaiting OTP** on
`/admin/payments`, which calls `POST /transfer/finalize_transfer { transfer_code, otp }` (or `POST /transfer/resend_otp
{ transfer_code, reason: "transfer" }`), see `lib/payout-otp-server.ts`. We send one transfer per payout, never `POST /transfer/bulk`,
which Paystack refuses while OTP is on. Switching OTP off (Settings → Preferences) makes payouts fully automatic, at the cost that the
secret key alone can then move money.

## 2. Which provider a payment goes to

| The payment | Goes to | If that fails |
|---|---|---|
| A plan or add-on (Pro, Business, Enterprise, Send-Na, inventory, team hub) | Paystack subscription | — (a subscription stays where it started) |
| A one-off card payment in Naira (booking, shop order, course, certificate, boost, gift) | Paystack | — |
| A bank transfer in Naira (any of the above, and wallet top-ups) | Paylony dedicated account | Paystack's pay-by-transfer |
| Tap2Pay (CardTap) | Paylony | — |
| A publisher payout | Paylony | Paystack transfer |
| A payment from Ghana, Kenya or another African country, mobile money, or a non-Naira card | Flutterwave (once live) | Paystack card in Naira, at the day's rate |
| A subscription paid in another currency (§7): USD, GBP, EUR, CAD, JPY, AED, CNY (anywhere unlisted pays USD) | Stripe (NotesApp Inc) | the reader picks another currency |
| A subscription paid in another African currency (§7): KES, GHS, ZAR, UGX, TZS, RWF, ZMW, EGP, MAD, DZD, TND, LYD, GMD by card or mobile money; XAF and XOF by mobile money once switched on in Flutterwave (Malawi pays USD) | Flutterwave | — |
| A naira reader of a creator who earns in another currency (§7) | Paystack, one month at a time | — |

## 3. One payment layer (the engineering work)

Today each provider is called from its own file (`lib/paystack.ts`, `lib/paylony.ts`, `lib/paylony-payouts.ts`, `lib/payments.ts`,
`lib/payouts.ts`). Before Flutterwave arrives, these sit behind one layer:

1. **A provider interface:** start a payment, verify it, refund it, pay out, and read a webhook. One file for each provider implements it.
2. **A router:** picks the provider from the table in §2 (method, country, currency), with the backup when the first choice fails.
3. **One record per payment:** whichever provider took it, `lib/payments.ts` records it the same way (amount in the smallest unit,
   currency, provider, reference), so finance reports, refunds and the ledger don't care which provider was used.
4. **Webhooks:** one route per provider, each checking that provider's signature, all handing over to the same settle step.
5. **Tests:** the router's choices, and each provider against its sandbox.

The payout switch that already exists (Paystack or Paylony) is the first piece of this; the rest grows from it.

## 4. Flutterwave and the move across Africa

In this order (the owner's decision, 29 October 2026: Kenya first, because Kenyan members are already on #NotesApp). It doesn't
wait for NotesApp Inc, which is for dollars and the app stores:

1. **Kenya:** M-Pesa (the customer approves the payment on their phone) and shilling cards; it sits well with Kiswahili, which we
   already have through NKENNEAi.
2. **Ghana:** cedi cards and mobile money (MTN MoMo, Telecel Cash, AirtelTigo), four to six weeks after Kenya opens.
3. **Then by demand:** South Africa, Uganda, Tanzania, Rwanda and others, as members arrive.

For each country: prices in the local currency (set in the admin like the Naira prices, never converted on the fly at checkout),
payouts to local banks or mobile money, tax and invoice rules, and the help articles. Before signing, confirm Flutterwave's licence
and standing in each country, and get written fees.

## 5. NotesApp Inc (Delaware) and what it changes

The owner is incorporating **NotesApp Inc** in Delaware, due in about two weeks. NOTESAPP TECHNOLOGIES LTD (Nigeria, RC and TIN in
`lib/site.ts`) carries on. For payments and the apps, the US company means:

- **The app stores:** Apple and Google accounts can be opened as an organisation (the mobile plan, `docs/MOBILE-APPS.md`). Both ask
  for a **D-U-N-S number**; apply for one for NotesApp Inc as soon as it exists, since it can take a few weeks.
- **Dollars:** payments in US dollars (members and businesses abroad, the diaspora) can be taken by the Inc. Flutterwave can do
  this; Stripe (which owns Paystack) is the other option to compare.
- **Which company takes which money:** to be set with the owner's lawyer and accountant (which company sells what, and how the two
  share costs and the brand). The site keeps showing NOTESAPP TECHNOLOGIES LTD until that's decided.

## 6. What the owner decides next

1. Paylony virtual accounts: switch them on for wallet top-ups first, then for payments.
2. When the payout switch should go automatic (for example, Paylony first and Paystack after one failure).
3. Flutterwave: **Kenya first, then Ghana (decided, 29 October 2026), on this timeline:**
   - **Now:** open the Flutterwave business account under NOTESAPP TECHNOLOGIES LTD and start its checks.
   - **November:** build the one payment layer (§3), then Flutterwave behind it with M-Pesa and shilling cards, tested in its
     sandbox; shilling prices set in the admin.
   - **Early December:** a quiet pilot with the Kenyan members already on #NotesApp: real money, small amounts.
   - **January 2027:** open to everyone in Kenya. Ghana four to six weeks later.
   - Until then, Kenyan members can pay by card in Naira through Paystack.
4. Dollars: **Stripe for the Inc (decided, 9 November 2026):** Stripe for USD, GBP, EUR and the rest of the world; Paystack for the
   naira; Flutterwave for the other African currencies. Built for subscriptions in §7.

## 7. Global subscriptions (built, v0.158.0, 9 November 2026)

The owner, 9 November 2026: "a US reader can subscribe to a Kenyan creator and vice versa; the system auto-balances, because we keep a
balance in each currency." Code: `lib/currency.ts`, `lib/global-pay.ts` (rules), `lib/global-pay-server.ts`, `lib/stripe.ts`,
`lib/flutterwave.ts`; routes `/api/global/*`, `/api/stripe/webhook`, `/api/flutterwave/webhook`, `/api/publisher/global`,
`/api/admin/treasury`; pages: the Subscribe button's currency picker, Rates & payouts → "Readers in other currencies", Admin → Treasury.

**The model: NotesApp is the seller.** The reader buys the subscription from NotesApp; the creator earns their share as earnings in
their own currency. NotesApp never receives a reader's money "for" a creator and sends it on, which would be money transmission (state
licences in the US, a payment licence from the Central Bank of Kenya, CBN approval). Each pool is NotesApp's own money; balancing them
is treasury work.

- **Prices:** a naira creator's usual tier prices are their home prices (they can switch readers abroad off). A creator who earns in
  another currency sets their prices in it ($0.50 to about $500 a month). The reader pays the home price in the same currency, or it
  converted at **Finance's exchange rates** plus a margin (3% by default), rounded up to a tidy price. Rates are set on Admin →
  Treasury, never pulled from a live feed at checkout; older than 48 hours, cross-currency checkouts pause until Finance updates them.
- **Earnings are fixed at the sale,** in the creator's currency, from their own price less the usual rate (a tier's share included):
  the exchange rate never changes what they earn. Held 7 days for refunds and chargebacks, then due.
- **One month per payment.** No automatic charge outside the Paystack plans: the reader gets a bell 3 days before the month ends and
  renews (a renewal adds a month on top). Someone on a monthly Paystack plan cancels it before paying in another currency.
- **Pools (`treasuryPools/{currency}`):** collected, paid out, converted in and out, and owed to creators. A pool is short when it
  holds less than it owes plus the reserve (10% by default). Sales in opposite directions mostly cancel out; the Treasury page suggests
  conversions from pools with money to spare, Finance converts through a licensed bank or provider and records what actually moved.
- **Payouts:** Finance pays what's due per creator and currency, only when that pool has the cash. African currencies other than the
  naira go through Flutterwave to the creator's bank or mobile money (their details: last 4 on show, the number encrypted with
  `ACCOUNT_DATA_KEY` in `globalPayoutSecrets`); naira, dollars, pounds, euros and Canadian dollars are paid by Finance and recorded
  with the bank's reference (Stripe Connect for creators in the US, UK and Europe is next).
- **Refunds:** from the Treasury page, back through the provider; the month is taken off and the earning cancelled (an earning
  already paid out is refunded by hand).
- **Which company:** Stripe belongs to NotesApp Inc; Paystack and Flutterwave to NOTESAPP TECHNOLOGIES LTD. A dollar reader of a
  Nigerian creator means the Inc collects and the Ltd pays, so the two need a written **intercompany agreement** (who sells what, how
  revenue and costs are shared, transfer pricing) from counsel before real money moves (FUNDING.md §5a, step 5).
- **Tax:** as the seller, NotesApp owes the tax on each sale: EU and UK VAT, US state sales tax on digital goods, Kenya's VAT on
  digital services, Nigeria's VAT. Stripe Tax covers Stripe's side once switched on; the African taxes need the accountant.
- **CBN:** naira conversions go only through licensed channels; Nigerian members' wallets stay in naira (FUNDING.md §5).

**Provider fees:** we confirm the amount we asked for (Flutterwave's `amount`, not `charged_amount`; Paystack's `requested_amount`), so
"Charge my customers" in either dashboard can't break confirmation, but it makes the reader pay more than the price shown on
NotesApp. Recommended: "Charge me for this" on Flutterwave's transaction and international fees (the conversion margin covers them).

**To switch it on:** Stripe activated (EIN, a US bank account) with `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` (events
`checkout.session.completed`, `checkout.session.async_payment_succeeded`); Flutterwave live with `FLUTTERWAVE_SECRET_KEY` and
`FLUTTERWAVE_WEBHOOK_HASH`; `ACCOUNT_DATA_KEY` set; rates entered on Admin → Treasury; `firebase deploy --only firestore`. Sandbox keys
work for testing first.
