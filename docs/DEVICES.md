# Notes Smart Devices (devices.<domain>)

Owner, 19 Nov 2026: devices.<domain> is the permanent home of #NotesApp's own devices, with one free reservation list for all of
them: **NotesPhone** and **Anya smart glasses** today (Anya keeps its own page, now at devices.<domain>/anya), and any future device as
one more entry in `DEVICES` (`lib/devices.ts`, with its `family`, its colours, and `moq` when ordering waits for reservations).

## NotesPhone

A white-label phone partnership. Phones in #NotesApp's name, made by a partner on their operating system, with
#NotesApp built in. The partner is not named on the site until the agreement is signed (`PARTNER_NAMED` in `lib/devices.ts`).

## The plan agreed so far (from the owner's messages with the partner)

- **One model first: NotesPhone E Pro**, on the partner's flagship shell (MediaTek Dimensity 9000, 6.7" AMOLED, 200 MP camera,
  16 GB + 1 TB or 12 GB + 256 GB, 5000 mAh with 67 W charging).
- **Minimum order: 500 units per model.** Delivery 33 days after payment, per the partner; research and development starts only after payment.
- **2027, interest only:** E Ultra (expandable lens, research and development paid by us, design patented for us), E Ultra+ (expandable lens and
  robotic camera; the partner can't add the robotic camera to white-label phones before 2027) and E Prestige (hand-finished).
  Listed for reservations, never ordered until 500 people want one.
- Adding #NotesApp to the core of the partner's OS has a cost, not yet quoted.

Still waiting on the partner (the owner's questions of 19 Nov): the cost of #NotesApp in the OS (one-time or per device), the E Pro
unit price at 500, the colours (asked: ivory, crimson, maroon, silver, gold, black), the delivery date, whether listing the 2027
phones is fine with them, and the R&D cost of the expandable lens.

## What the site does

- `devices.<domain>` serves `/devices` at its root (`app/(main)/devices/page.tsx`) and `/anya` beside it; the main site and the app
  send `/devices` and `/anya` there (`middleware.ts`, `lib/host.ts` `DEVICES_HOST`). No sign-in of its own.
- NotesPhone: what each phone is, E Pro's planned specification and the colours asked for. Anya: the three models, each linking to
  the Anya page and to its reservation. The Anya page's buttons open the reservation form with that model (`?model=anya-display#reserve`).
- **Free reservations** (`components/devices/ReserveForm.tsx` → `POST /api/devices/reserve` → `submitDeviceReservation` in
  `lib/leads-server.ts`): a lead of category `device-reservation`, one per device per email (a colour is checked against that device's own colours). A thank-you email, and a bell for a
  signed-in member. Rate limited to 6 an hour per address and per member. Browsers can't write these leads directly (`firestore.rules`).
- **Admin → Leads → Smart devices:** each device's reservations (counted on the server), the phones' against the 500, and the colours asked for.
- Anya's old interest leads (contact topic "anya") stay in Admin → Leads; the topic still exists on the contact form.
- No price, no date and no payment anywhere until the partner confirms them. The help article says not to trust anyone asking for
  money for a NotesPhone or Anya today.

## Owner steps

1. Vercel → Domains: add `devices.naapp.tech` (and `devices.notesapp.name.ng` if wanted), CNAME to Vercel.
2. `firebase deploy --only firestore:rules` (browsers may not create `device-reservation` leads).
3. Once the partner agrees in writing: set `PARTNER_NAMED` to name them, and add the price, the date and the confirmed colours.

## Tests

`npm run test:devices` (what a reservation keeps; no price or date on the page), `npm run test:devices-server` (Firestore emulator:
one per phone per email, the email, the bell, the counts), `npm run test:host` (the address), `npm run test:rules`.
