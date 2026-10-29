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

## 2. Which provider a payment goes to

| The payment | Goes to | If that fails |
|---|---|---|
| A plan or add-on (Pro, Business, Enterprise, Send-Na, inventory, team hub) | Paystack subscription | — (a subscription stays where it started) |
| A one-off card payment in Naira (booking, shop order, course, certificate, boost, gift) | Paystack | — |
| A bank transfer in Naira (any of the above, and wallet top-ups) | Paylony dedicated account | Paystack's pay-by-transfer |
| Tap2Pay (CardTap) | Paylony | — |
| A publisher payout | Paylony | Paystack transfer |
| A payment from Ghana, Kenya or another African country, mobile money, or a non-Naira card | Flutterwave (once live) | Paystack card in Naira, at the day's rate |

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
4. Dollars: Flutterwave or Stripe for the Inc.
