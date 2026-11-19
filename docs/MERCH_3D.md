# 👕 Merch in 3D

Official #NotesApp merch (`/merchstore`, `lib/merch.ts`) that a buyer can turn all the way round, in the colour and with the logo they
choose, with the price updating as they choose. Prices, colours, extras and batch dates move from the code into Admin, and the team
gets a print sheet for each batch.

The owner put Merch last in their order on 15 Nov 2026, and on 18 Nov 2026 asked for it next, with sample screens first; signed-out
viewing and sharing of public lives comes after it. **Status: built in v0.186.0 (19 Nov 2026)** after the owner's "approved build", with their four custom
shirt designs at ₦10,000 and a name on the back for ₦4,000 more. What was built, and what wasn't, is at the end of this page.

The idea comes from Charlie Hills' article "5 things to build with Fable 5.2" (a 3D product view that turns). Only the idea is used.

## Today

- Seven items (T-shirt, cap, mug, Stanley-style cup, mouse pad, coffee cup, laptop bag), each a flat drawing with the logo laid on top.
- One colour each. Nine logos (the core mark and eight seasonal ones). Sizes for the T-shirt.
- Prices, the batch and the delivery fee are written in `lib/merch.ts`; a change needs a release.
- **Batch 1 closed on 15 Nov 2026**, so the store isn't taking orders now. A new batch needs new dates.

## The mockups

All screens on one sheet: [all-screens.webp](mockups/merch-3d/all-screens.webp). HTML source: [mockups.html](mockups/merch-3d/mockups.html).
The drawings stand in for the 3D models.

1. The store: every item turning slowly, with its colours and starting price ([1-the-store](mockups/merch-3d/1-the-store.webp))
2. Turn it, then choose colour, logo and where it's printed ([2-turn-and-choose](mockups/merch-3d/2-turn-and-choose.webp))
3. Every side: the back print, and the turn from front to back ([3-every-side](mockups/merch-3d/3-every-side.webp))
4. The price, line by line, updating as you choose ([4-the-price](mockups/merch-3d/4-the-price.webp))
5. Every phone: Reduce motion, and phones that can't show 3D ([5-every-phone](mockups/merch-3d/5-every-phone.webp))
6. Admin → Merch: prices, colours, extras, batch dates, delivery ([6-admin-settings](mockups/merch-3d/6-admin-settings.webp))
7. Admin → Merch: the print sheet for a batch ([7-print-sheet](mockups/merch-3d/7-print-sheet.webp))
8. After you pay: your design in 3D beside the tracking ([8-after-you-pay](mockups/merch-3d/8-after-you-pay.webp))

## Decisions for the owner

Each has a recommendation. The build follows it unless the owner says otherwise.

| Question | Recommendation |
|---|---|
| Which items turn | **All seven**, as simple models built in code with `three` (already installed): no model files to buy or host. They are clean product shapes, not photographs; real product photos can still be added later, as today. |
| Colours | **Set per item in Admin.** To start: T-shirt in Black, White, Crimson, Navy and Sand; cap in Crimson, Black and White; mugs and cups in White and Black. **Check with the printer which blanks they stock** before opening the batch. |
| Extras that cost more | **Set in Admin**, shown on the choice itself ("XXL +₦1,000"). To start: front and back +₦2,500, XXL +₦1,000, wrap-around mug print +₦1,000. These are placeholders until you set real ones. |
| Where it's printed | T-shirt: front, small on the chest, or front and back. Other items: one place each (the mug can wrap around). |
| Prices, batch, delivery | **Moved into Admin → Merch**, logged with who changed what. Checkout reads the same settings, so the price shown is the price charged; orders already paid keep their price. |
| The next batch | You set Batch 2's dates in Admin. Until then the store shows "The next batch opens soon" and the choices still work, without the Pre-order button. |
| Speed | The 3D view loads only when an item is opened (about 200 KB). The store page uses still pictures made from the same models, so it stays light on slow connections. |
| Reduce motion, older phones | Nothing turns on its own with Reduce motion on; arrows turn it. Phones that can't show 3D get still pictures of each side, with the same choices and price. |
| Members' own merch | **Not in this release.** Members selling their own logo on our blanks is a separate decision about printing, stock and earnings. |

## How it will work

- **The models** (`components/merch/`): each item is a few shapes in `three` (a T-shirt from a shaped outline with depth, a mug from a
  turned profile with a handle, and so on), coloured from the chosen colour, with the logo as a decal on each print place. A slow turn
  until touched; drag to turn, pinch or scroll to look closer, Front and Back buttons. Loaded with a dynamic import on the item page only.
- **The settings** (`lib/merch.ts`, Admin → Merch): items, prices, colours, extras, print places, the batch and the delivery fee, kept in
  one settings document with a change log. The code's values become the defaults.
- **The price** (pure, tested): `merchPrice(item, choices, settings)` gives each line and the total. The store, the item page, checkout
  (`/api/paystack/initialize`) and the receipt all use it, so they can't disagree. A choice that isn't on offer is refused at checkout.
- **The order** (`merchOrders`): gains colour and print place; tracking and the admin list show them. Older orders read as they do now.
- **The print sheet**: paid orders of a batch grouped by item, colour, logo, print place and size, with a picture of each design taken
  from the 3D view; a download for the printer and "Mark all printed".

## Build order (after approval)

1. `merchPrice` and the settings shape, pure and tested; the code's current values as defaults.
2. Admin → Merch settings, with the change log; checkout and the receipt reading them; tests on the emulator.
3. The 3D view and the seven models; the store's still pictures from them; Reduce motion and the still fallback.
4. The item page: colours, logos, print place, size, quantity, the price lines; the order gaining colour and print place.
5. The print sheet; the design in 3D on the order and tracking pages.
6. Screenshots from the real code for the owner. Then the help article, changelog, README, HANDOVER and BUILD_LOG.

## Not in the first release

- Members' own merch.
- Photographs of each colour (the models stand in).
- Personal text or a name printed on an item.
- Delivery outside Nigeria.

## Built in v0.186.0

- **The owner's custom shirts** (19 Nov 2026): Maroon Splash, Black Drip, Ivory Drip and Maroon Stripes, cut out of the owner's
  pictures into `public/images/merch/designs/` (`MERCH_DESIGNS` in `lib/merch.ts`). ₦10,000 each; a name on the back of any shirt
  ₦4,000. The owner sent the fronts only, so **the back is drawn in each shirt's main colour**, with the sleeves and collar from the
  picture, the name and a small mark; a back design can replace it later.
- **The rules** `lib/merch.ts` (pure, tested): colours (`MERCH_COLOURS`), print places (`placesFor`), names on the back
  (`cleanBackName`: 12 characters, capitals, letters, numbers and . ' -), `quoteMerch` (the price, line by line, refusing any choice
  not on offer), `merchOrderInfo` (what a paid order records), the print sheet key and `choiceText`.
- **Admin's settings** are a `merch` section of the pricing settings (`lib/pricing.ts`, `platformSettings/pricing`, `pricingLog`):
  saved by the owner and super admins on Admin → Merch → Settings, in force everywhere within 20 seconds, logged with who changed
  what. `MERCH_BATCH`, the items' prices and the delivery fee (`merchDeliveryKobo()`) are live values those settings overwrite, so
  campus rewards and every older reader keep working. The batch can now have an opening day; Batch 1 closed on 15 Nov, so **the
  store takes no orders until Batch 2's dates are set**.
- **Checkout** (`/api/paystack/initialize`, kind `merch`) quotes the order again with `quoteMerch` and records colour, print place,
  design, name and the price lines on the payment and `merchOrders/{ref}`; the receipt email says what was chosen. Older orders and
  campus rewards read as before.
- **The 3D view** `components/merch/scene.ts` and `Merch3D.tsx`: models built in code with `three` (no model files). Shirts are two
  curved sheets cut to the shirt's outline, with the design or the colour and logo drawn onto them; mugs and cups are turned bodies with
  handles and lids; the cap a dome and brim; the mouse pad and laptop bag rounded slabs. Loaded only on an item page. It turns slowly
  until touched; Reduce motion stops it and shows arrows; if 3D can't run, the flat picture shows.
- **Screens:** `/merchstore` (custom shirts and items as pictures, the batch line from Admin), `/merchstore/<item>` (the 3D view and
  every choice, the price lines, the address and Paystack), Orders (the chosen design with "Turn it"), and Admin → Merch (Orders and
  print sheet, Settings).
- **Tests:** `npm run test:merch` (pure) and `npm run test:merch-server` (Firestore emulator), both in CI.

Screenshots from the real code, with sample data on the emulators: [built.webp](mockups/merch-3d/built.webp).

## Changed from the mockups

- **Custom shirts came first**, as the owner's own designs, beside the blank items.
- **The store shows pictures**, not turning models, so it stays light; the item page turns.
- **The print sheet's download is a spreadsheet** (CSV) listing each piece, how many and the order references, with the design's name;
  custom shirts print from the design file. Pictures of each design are on the sheet in Admin, not in the download.
- **The tracking page** (`/track/<parcel>`) is unchanged; the design and "Turn it" are on Orders.

## Not built, or still to do

- **Batch 2's dates and the real extras.** Set them in Admin → Merch → Settings: the front-and-back, XXL and wrap prices are
  placeholders. **Check with the printer which colours they stock** before opening the batch.
- **Back designs for the custom shirts**, if the owner has them: the backs are drawn in the main colour until then.
- **Older and low-end phones** weren't tested on real devices; the build environment's browser draws 3D in software.

## What comes after

Signed-out viewing and sharing of public lives (owner, 18 Nov 2026: after Merch).
