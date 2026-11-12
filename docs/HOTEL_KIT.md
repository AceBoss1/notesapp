# 🏨 Hotel kit: a full hotel on #NotesApp

The hotel's website, room bookings, food and drink orders from every department, payment online or at the counter, a live staff board,
a kitchen screen and tills, all in NotesApp's own app. The owner asked for it on 12 Nov 2026, using Hotel Ops
(github.com/vicintel/hotel-ops) as the reference. **Status: mockups awaiting the owner's approval. Nothing has been built yet.**

Hotel Ops has no licence file, so none of its code is copied. We take its ideas and its payment rules (only a verified payment marks an
order paid, holds expire, late money is kept and flagged, and the AI never states a price itself) and build them on our own stack:
Firestore, Paystack, Paylony, Business books, Inventory, Sites and Nana.

## Decisions (owner, 12 Nov 2026)

Three tiers ride on the plans we already sell, plus add-ons. There are no new subscriptions. Every price, the department limit and the
late-order time are set in Admin, so help pages never print a figure.

| Tier | Plan | What's in it |
|---|---|---|
| 🛎 Hotel Starter | Pro | Hotel site kit; rooms, availability and online booking; menus and orders for one department; pay online; booking and order bells; Business books |
| 🏨 Hotel Standard | Business | Starter, plus several departments (limit set in Admin); live staff board; kitchen screen; tills with PINs and cash-up; stock (Inventory); charge to the room bill; own domain; staff roles by department |
| 🏰 Hotel Grand | Enterprise | Standard, plus several branches with one owner view; Nana chat ordering on the website; Conversations (staff read every chat); monthly reports by branch and department; priority help |

**Add-ons (any tier, monthly, priced in Admin):** 💬 WhatsApp ordering (Nana on the hotel's own WhatsApp Business number), 🏦 a bank
account number for each order (Paylony one-time accounts, `lib/paylony.ts`), 💳 card-machine link (Moniepoint push-payment and signed
webhooks), 🧹 Housekeeping (rooms dirty, cleaning or ready; maintenance; lost and found) and 🧰 Set it up for me (our team fills in the kit).

## The mockups

All screens on one sheet: [all-screens.webp](mockups/hotel-kit/all-screens.webp). HTML source: [mockups.html](mockups/hotel-kit/mockups.html).

1. The hotel's website ([1-hotel-site](mockups/hotel-kit/1-hotel-site.webp))
2. Book and pay ([2-book-and-pay](mockups/hotel-kit/2-book-and-pay.webp))
3. Order from any department, to a room, a table or for pick-up ([3-order-food](mockups/hotel-kit/3-order-food.webp))
4. Live staff board ([4-staff-board](mockups/hotel-kit/4-staff-board.webp))
5. Kitchen screen ([5-kitchen-screen](mockups/hotel-kit/5-kitchen-screen.webp))
6. Tills and cash-up ([6-till-cash-up](mockups/hotel-kit/6-till-cash-up.webp))
7. Order by chatting with Nana ([7-nana-chat-order](mockups/hotel-kit/7-nana-chat-order.webp))
8. Three tiers and add-ons ([8-tiers-add-ons](mockups/hotel-kit/8-tiers-add-ons.webp))

## How it will work

- **Site.** A new `hotel` kit in `lib/site-kits.ts` with Rooms, Departments and menus, Gallery, Location and Reviews sections, on the
  existing looks, colours and cover photo.
- **Data** (server-only, written by `lib/hotel-server.ts`): `hotels/{id}` (owner, branches, departments, policy), `hotelRooms`
  (type, price, count, status), `hotelBookings` (dates, hold until, status), `hotelMenu` (per department, sold out, stock link to
  Inventory), `hotelOrders` (department, room/table/pick-up, status `pending → awaiting_payment → paid → preparing → ready → completed`
  or `cancelled`), `hotelTills`, `hotelStays` (checked-in guest and room bill).
- **Money rules.**
  - Only a verified payment sets `paid`: the Paystack webhook, Paylony, or a Moniepoint signed webhook, each idempotent on the
    provider reference. The status API refuses `paid`.
  - Unpaid orders and room holds expire after the hold time set in Admin, and the room goes back on sale.
  - Money that lands late is stored and flagged for rebooking or a refund.
  - Room-bill charges are settled at checkout.
  - Every sale is written to Business books, and stock goes down in Inventory.
  - The hotel's money follows the existing seller payout ledger and commission for its plan.
- **Live board and kitchen screen.** Firestore listeners on the department's orders (as Business books' live views do). The kitchen
  screen plays a sound and reads new orders aloud with the browser's speech, and the late time comes from Manage.
- **Staff.** Team members with a department role (front desk, a kitchen, a bar, manager), using the organisation team access we
  already have. Tills have their own PIN and are locked to one department.
- **Nana ordering (Grand, and WhatsApp add-on).** A tool-using Nana per department: list menu, list rooms, build the order, confirm,
  place, and get the pay link or account. Prices, totals and account numbers come only from tool results. It works in English, Pidgin,
  Yorùbá, Igbo and Hausa, and every chat and its steps are saved for Conversations.

## Build order (after approval)

1. Starter: kit, rooms and booking with holds, menus and orders for one department, Paystack, bells and books.
2. Standard: departments, staff board, kitchen screen, tills and cash-up, room bill, Inventory.
3. Grand: branches, Nana ordering, Conversations, reports.
4. Add-ons: Paylony account per order, Moniepoint, WhatsApp, Housekeeping.

Each step ships with its public page, help article, changelog, HANDOVER and BUILD_LOG.
