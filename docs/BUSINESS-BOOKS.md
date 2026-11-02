# Business books (plan, and what's built)

> **Built, 2 Nov 2026 (v0.118.0):** build steps 1 to 6 below (the walk-in half, P&L, money owed and imports), after the owner's "start
> building books". **Next:** steps 7 to 10 (Nana entries, offline entry, the monthly email, staff roles). What was built, and where it
> differs from this plan, is in **section 10**. The owner's answers (2 Nov): pricing option A, the name "Business books", only store
> orders flow in for now, CSV only (no Excel library), WhatsApp click-to-send for non-members, SMS greyed out until Send-Na.
>
> Status when written: **plan, for the owner's approval.** Written 1 November 2026. The mockups (phone and desktop, Day and
> Night) came first, for approval, before any code. The owner's brief: "plan Business books, add import your existing data, if we do
> not support it yet then suggest to support". This plan has the owner's earlier suggestions in it too: Nana bookkeeping from a short
> message, honest reporting, and "import your Tralo or Excel stock list" for the Ghana launch.
> **Decided 1 Nov 2026:** customers who aren't #NotesApp members get receipts and debt reminders by WhatsApp (SMS through Send-Na when
> the seller opts in), each with a short #NotesApp line. This is an approved exception to "our own tools first" (section 2).
> **Decided 2 Nov 2026:** Business books is never labelled "coming soon". It has a **waitlist** instead (built, v0.115.0):
> - **The page:** `/books` says what Business books will do. It's honest that it isn't open, promises no date, and shows three of the
>   mockups (`public/images/books/`).
> - **The form:** name, email (filled in for members), kind of business, what they sell, how they keep books today (exercise book,
>   Excel, Tralo, another app, nothing), city, and "email me when it opens".
> - **Where sign-ups go:** `/api/books/waitlist`, rate limited, 5 an hour per address and per member (`lib/books-waitlist.ts`). Each
>   sign-up is a lead of category `books-waitlist` (one per email; signing up again updates it), written by the server only
>   (`firestore.rules`). They're shown on Admin → Leads → **Business books waitlist**, with counts by kind of business and by how
>   people keep books today.
> - **Thanks:** a thank-you email, plus a bell for members.
> - **Links to the waitlist:** the roadmap's not-live list ("Business books — join the waitlist"), the Business books section on
>   `/store-selling` (`#business-books`), the home page's features and the Inventory and Selling physical goods help articles.

## 1. Who it's for and the problem

Market traders, shops, food vendors, salons, barbers, tailors, service providers, and small NGOs and churches that sell things.
Most of their selling happens **in person**: someone walks in, pays cash, transfer or POS, or takes the goods and says "I'll pay you
Friday". Today they keep this in an exercise book, a WhatsApp chat with themselves, or a spreadsheet. So at the end of the month they
can't say what they made, who owes them, or what to restock.

#NotesApp already handles the **online** half: a store, a cart, Naira payments and payouts, parcel tracking, inventory (stock, SKUs,
cost prices, low-stock alerts), bookings, courses, discount codes and Nana. What sellers lack is the **offline** half:

- walk-in sales, with a receipt;
- expenses;
- money owed to them (credit sales) and money they owe suppliers;
- profit for a day, a week or a month.

**Business books** puts both halves in one place. The team-hub finance ledger (`lib/finance.ts`) is our own company's books and stays
staff-only. Business books is a new, separate thing for members. It doesn't reuse that ledger's data.

## 2. What's in it

The screens are in the mockups (section 9). In short:

### Sales
- **Online store orders flow in by themselves.** When an order is paid (`lib/orders-server.ts`), a sale entry is written with the
  order reference. A refund writes a matching negative entry. Our commission on the order is written as an expense line ("#NotesApp
  commission"), so profit is true. Booking and course income can come in the same way later (open question 3).
- **Quick walk-in sale.** A big **＋ Record a sale** button on Books home opens a sheet:
  - search your inventory by name, SKU or barcode, or sell a one-off item by typing it ("2 yards lace");
  - change the quantity and the price (a discount);
  - choose how they paid: **Cash, Transfer, POS or Credit**;
  - a **Customer owes** toggle with the customer, the part paid now and a due date. The rest goes to *Money owed to you*.
- **Receipts.** Each sale gets an unguessable link on the primary domain, `naapp.tech/receipt/<code>` (built; `/r/` is taken by referral
  links, `/r/<username>`). The receipt page shows the shop's name and logo, the items,
  the total, how it was paid and what is still owed, but never the seller's or buyer's phone number.
  - **A customer who is a #NotesApp member** gets it by email and bell, as planned.
  - **A customer who isn't a member** gets it by **WhatsApp**: **Send receipt by WhatsApp** opens WhatsApp on the seller's phone with
    the message already written, ending with the #NotesApp line (see *Customers who aren't on #NotesApp* below).
  - **SMS** goes too when the seller has switched on Send-Na.
  - The seller can still copy the link or share it any other way. **Receipt PDF** uses the browser's Save as PDF on a print page, as certificates and giving receipts do today
  (`components/academy/PrintNow.tsx`, `components/community/MyGiving.tsx`), so we add no PDF library. A small QR on the printed
  receipt opens the same link.

### Expenses
- Amount, date, paid how (cash, transfer, POS, card), a category and a note, and up to 3 **receipt photos** (stored privately, like
  message attachments, `lib/private-files-config.ts`).
- Starting categories, which sellers can rename or add to: Stock purchases, Rent, Staff pay, Power (diesel and NEPA), Transport and
  loading, Market and LG levies, Data and airtime, Repairs, Salon or workshop supplies, Bank and POS charges, Other.
- Expenses that repeat every month (rent, staff pay) can be set to repeat, so the seller only confirms them.

### Stock (linked to the existing inventory)
- A sale of an inventory item lowers its stock through the same path online orders use (`inventoryMoves`, reason `sale`, with the
  book entry's reference). A **purchase** (restock) raises it (reason `restock`) and records what it cost, which also updates the cost
  price if the seller ticks it.
- Low-stock alerts are the ones inventory already sends (`lowStockAlert`, `crossedLow`), now also set off by walk-in sales.
- Without inventory (no add-on), walk-in sales still work with typed items. Stock just isn't counted, and Books says so.

### Money owed to you and money you owe
- **Owed to you (debtors):** each customer with an open balance, what for, since when, the due date, and *late* in red once it passes.
  Record a payment (all or part) in two taps.
- **Reminders.** Each reminder links to the customer's statement, where they can **pay by card or transfer through our checkout** (a
  new payment kind, `debt`, paid to the seller like any sale).
  - **Members** get it by **email and bell**.
  - **Non-members** get it by **WhatsApp**: **Remind by WhatsApp** opens a prefilled message on the seller's phone, ending with the
    #NotesApp line.
  - **SMS** goes as well when the seller has opted in to Send-Na (`docs/SEND-NA.md`). We have no SMS sending today, so the mockup
    shows SMS greyed out, "with Send-Na".
  - Automatic reminders (email and bell, and SMS once Send-Na is on) can repeat every 3 days, at most 3 times. A WhatsApp reminder is
    sent by the seller's own tap, so Books only *prompts* the seller when the next one is due.
  - One reminder a day per person at most, and the customer can turn reminders off from the statement link.

### Customers who aren't on #NotesApp: WhatsApp and SMS, with a #NotesApp line (owner's decision, 1 Nov 2026)
Most people who owe a market trader aren't #NotesApp members, so email and the bell don't reach them. The owner approved an
**exception to "our own tools first"**: debt reminders and receipts to **non-members** go by WhatsApp (and SMS through Send-Na), and
each one ends with a short #NotesApp line. Our own tools can't reach these people, and every message is a small invitation to join,
so it doubles as a growth channel. Members keep email and the bell.

The line, the same on every message:

> Sent with #NotesApp Business books. Keep your own books free: naapp.tech/books

The link carries the seller's referral code, so the seller earns if the customer joins (`docs/REFERRALS.md`; open question 10).

**Two ways to send by WhatsApp:**

| | Click to send (`wa.me`) | WhatsApp Business API |
|---|---|---|
| How | Books builds a `https://wa.me/<customer's number>?text=<the message>` link. Tapping it opens WhatsApp on the seller's own phone with the message written. The seller taps Send. | #NotesApp sends from its own verified WhatsApp Business number through Meta's Cloud API (or a provider), with no tap from the seller. |
| Cost to us | Free | Meta charges per message. Each message is a template Meta must approve first. |
| Comes from | The seller's own number, which the customer already knows and trusts | A #NotesApp number |
| What we know | Only that the seller opened WhatsApp, not that they sent it. Books records "WhatsApp opened" with the time. | Sent, delivered and read |
| Repeats | The seller taps each time; Books reminds the seller when the next one is due | Automatic |
| Risks | None on our side | Meta's rules: the customer must have agreed to receive messages, and a template with a promotional line can be charged at the dearer marketing rate. Check the current rules before building. |

**Recommendation:** start with **click-to-send**. It's free, it needs no approval from Meta, and the message comes from someone the
customer knows. Look at the Business API later, together with Send-Na's WhatsApp channel (`docs/SEND-NA.md`), if sellers ask for
automatic reminders.

**SMS (Send-Na):**
- When the seller opts in to Send-Na (once it's built), reminders and receipts to non-members also go by SMS. The seller pays per SMS.
- Each SMS ends with a short line, "Sent via #NotesApp naapp.tech", short enough to keep the message in as few SMS parts as possible.

**Rules for all of these:**
- Only a customer's phone number goes into the message link. No balances of other customers and no profit.
- The message is short and polite, with the amount, what it was for, the due date and the statement link (example in the mockups).
- One message a day per person at most.
- The customer can stop reminders from the statement link. A seller who keeps sending after that is warned.
- **You owe (creditors):** suppliers, what you owe them and when it's due, with a bell to the seller the day before.

### Profit and loss
- **Day, week and month** (and any range on Pro and above): sales (walk-in and online shown apart), refunds, cost of what was sold,
  gross profit and margin, expenses by category, net profit, and the change on the period before.
- **Cash in hand:** the opening float, plus cash sales and cash paid back, minus cash expenses. The seller can count the drawer and
  record the difference (an "over/short" line). Transfer and POS money are shown apart, as is money still held by #NotesApp for
  online orders (until it's paid out).
- **Best sellers** by units and by profit (Analytics already works out online best sellers, `lib/analytics.ts`).
- Profit needs cost prices. When items have none, Books says so ("2 items have no cost price yet, so profit may be a little high") and
  links to add them.

### Offline-first entry on phones
What we have today:
- #NotesApp is a **PWA**: it installs from the browser (`app/manifest.ts`), and `public/sw.js` already caches Naija Exam Prep packs for
  offline use, with saved progress kept on the device (`lib/exam-prep-local.ts`). Offline pages work there today.
- The **Capacitor** apps are scaffolded in `mobile/` but not built (`docs/MOBILE-APPS.md`). They wrap the same web app, so whatever we
  build offline for the web works in them too.
- The Firestore web SDK's offline cache is not switched on (`lib/firebase.ts`). It wouldn't help anyway: Books entries are written by
  the server (section 5).

What's feasible:
- The service worker caches the Books screens and a snapshot of the seller's items, prices and customers.
- New entries go into an **outbox in IndexedDB** on the phone, each with its own `clientId`. They show at once, marked "waiting to
  sync".
- The outbox is sent when the phone is back online (the `online` event, the next time the app is opened, and Background Sync where the
  browser has it: Chrome on Android does, Safari on iPhone does not). The server ignores a `clientId` it has already saved, so nothing
  is counted twice.
- Stock can go below zero if two phones sell the last bag offline. The server saves both sales, flags the item and tells the seller
  to count it. It never drops a sale.
- What isn't offline: Nana entries, imports, reminders and receipt links (a receipt link is made once the sale syncs).

### Staff and roles
- Cashiers record sales (and, if allowed, expenses) but **don't see profit, costs, totals for the day or other people's balances**.
  Managers see everything except settings and payouts. The owner sees everything.
- This builds on organisation teams: `orgMembers/{sellerUid}_{uid}` with `store: true` already lets a teammate run a store
  (`canActForSeller`, `canManageItems` in `lib/orders-server.ts`). A new field, `books: "cashier" | "manager"`, sets the role. Teams
  exist on Business (4 seats, `ORG_SEATS`) and Enterprise. Whether a market trader on Free Basic or Pro gets a cashier is open
  question 4.
- Every entry keeps who recorded it. A cashier can't delete an entry, only **void** it with a reason, and the owner sees voids.

### Nana bookkeeping
- Type or say it: **"Sold 3 bags of rice ₦45,000 to Mama Bisi on credit, she'll pay on the 15th"**. Nana turns it into an entry: the
  item matched from inventory (Rice 10kg, because ₦15,000 a bag is its price), the total, *Customer owes*, the customer matched from
  your customers, the due date and the stock change. Nothing is saved until the seller taps **Save**. When Nana isn't sure (two
  rice items), it says so on the card.
- Other examples: "Bought diesel 18k cash" (an expense), "Chinedu paid 20k" (money in), "Bought 10 bags garri at 52k each" (a
  restock), and a voice note in English or Pidgin (once voice transcripts are live, see the roadmap).
- It runs on **Pearl** (the light model), whatever gem the member has chosen for chat, and is **charged to the Nana allowance** through
  the same meter as Nana's writing help (`meterCheck` / `meterCharge` in `lib/nana-meter.ts`, as `lib/nana-assist.ts` does). One
  entry is about 1,500 tokens in and 200 out, about **₦0.40** at today's rates (`lib/pricing.ts`). Free Basic's ₦50 a week covers
  over 100 entries. Typing an entry yourself is always free.
- Nana gets only what the entry needs: the seller's item names and prices, and customer first names. Not balances or profit.

### Monthly summary email
- On the 1st, one email per seller for the month before: sales, expenses and profit (with the change on the month before), money owed
  with who is late, best sellers, what to restock, and a button to open Books.
- **Only sent when there was activity** (at least one entry that month). One email a month at most, sent once (a `bookReports/{uid_YYYY-MM}` record, as `kidReports` does), with an unsubscribe
  link. Profit isn't in the email of a member who has turned "show profit in emails" off.

### Honest numbers
- Books always shows **sales recorded**, **expenses recorded** and **stock value** as separate, clearly labelled numbers. Stock value
  is what the seller owns, not business they did, so it's never added to sales, profit or any "activity" headline.
- The same rule holds for our own public numbers: if we ever publish totals across sellers (on the home page, to investors or in
  the press), they're **sales recorded** and **expenses recorded**, each counted and labelled, with how many sellers recorded
  anything in the last 30 days. Never a total made bigger by adding stock value. (Tralo's "GH¢100m in business activity" is mostly
  stock: about GH¢84m of it is inventory, see section 6.)
- Online sales are counted once: an order's book entry is the order, not a second sale.

## 3. Import your existing data

### What can be imported today (checked in the code, 1 Nov 2026)

| Import | Where | What it does | Limits |
|---|---|---|---|
| Inventory spreadsheet (CSV) | `/profile/inventory`, `lib/inventory.ts` `planImport`, `/api/inventory` | Updates **existing** store items, matched by `item_id` or SKU: stock, SKU, low-stock level, cost price. Problems are listed and must be fixed before anything is saved. | CSV only (no Excel), our column names only, up to 2,000 rows, **can't create new items** or set prices, no undo |
| Publications | Your site → Publications, `lib/publications-import.ts` | BibTeX file (Google Scholar, Zotero, Mendeley), ORCID works (with daily sync), one paper by DOI (Crossref). Never adds the same paper twice. | Academic sites only |
| Exam Prep questions (CSV) | Admin → Exam Prep, `import_csv` | Questions from a spreadsheet | Staff only |
| Team-hub finance ledger (CSV) | `/admin/team/finance`, `lib/finance.ts` | Our own company's income and expenses | Staff only, not for members |
| Phone contacts | Notes Life invites | Picks friends from the phone (browser Contact Picker) to send an invite link | Nothing is saved. Not a contacts import |

**Exports today:** the inventory CSV, the sales CSV in Analytics (Pro and above, `salesCsv`), and Download your data (Account → Your
data).

**Not supported today:** creating items from a spreadsheet, Excel (.xlsx) files, Google Sheets, sales history, expenses, customers,
debtors, suppliers, Shopify, WooCommerce, Selar, Paystack exports, bank statements, contacts files (vCard), and photos of paper
records. (Written 1 Nov 2026; Books now imports all of these except Excel files, vCard and photos: see the table below and section 10.) There's no xlsx or PDF library in `package.json` today.

### Sources, and how we'd support each

| Source | What it brings | Today | How we'd support it |
|---|---|---|---|
| **Excel / CSV** | Stock list, sales, expenses, customers, debtors, suppliers | **Supported (v0.118.0)**, CSV only | One import wizard for every kind: upload, **match columns** (guessed from the headings, saved per source), **preview as a dry run**, import. Downloadable **templates** for each kind. Creates new items as well as updating them. CSV first; `.xlsx` once we add a vetted reader library (needs approval, open question 7). |
| **Google Sheets** | Same as Excel | **Supported (v0.118.0)**, by downloading CSV | Phase 1: File → Download → CSV, then the same wizard (the help article shows how). Later, maybe: paste a published-sheet link. |
| **Tralo** | Stock list, sales history, credit sales | **Supported (v0.118.0)** | Tralo's web app exports **inventory, sales history and inventory history as CSV**. Its inventory template has *Product Name, Category, Cost Price, Selling Price, Stock Quantity, Unit*. Its sales template has *date, time, product_name, quantity, unit_price, customer_name, customer_phone, payment_method, amount_paid, apply_taxes, notes*, with payment methods cash, mobile money, bank transfer and credit (from tralo.app, read 1 Nov 2026). A **Tralo preset** maps those columns for you. Credit sales with `amount_paid` below the total become *money owed*. Prices in GH₵ wait for cedi support (Ghana launch, `docs/PAYMENTS.md`). Until then a cedi file is refused with a clear message. |
| **Shopify** | Products (title, SKU, price, cost, stock); past orders | **Supported (v0.120.0)** | Presets `shopify-stock` and `shopify-sales`, from Shopify's help centre (products: help.shopify.com/en/manual/products/import-export/using-csv; orders: …/managing-orders/exporting-orders), both the older (*Handle, Title, Option1 Value, Variant SKU, Variant Price, Variant Inventory Qty, Cost per item*) and today's headings (*Title, URL handle, SKU, Option1 value, Price, Inventory quantity, Cost per item*). Each option is its own item; image-only rows are dropped. Orders: one sale per *Name* (line items on their own rows), *Financial Status* paid or partially_paid only (refunded and partially_refunded come in with a refund entry), *Outstanding Balance* owed, *Currency* other than NGN refused. Products become Books-only items (or update store items), orders past sales marked "imported". |
| **WooCommerce** | Products; past orders | **Supported (v0.120.0)** | `woo-stock` from the built-in exporter (the Product CSV schema: *ID, Type, SKU, Name, Stock, Low stock amount, Regular price, Categories, Parent*); a variable product is skipped and its variations come in. Woo has no built-in orders CSV, so `woo-sales` matches the two common plugins (Customer / Order / Coupon Export, one row per item; Advanced Order Export For WooCommerce). Their headings aren't all documented, so the wizard asks the seller to check the match. Completed and processing orders count. |
| **Selar** | Digital products and sales | **Supported, headings guessed (v0.120.0)** | We found no documentation of Selar's export (2 Nov 2026). `selar-sales` matches the likely headings (Date, Product Name, Buyer Name, Buyer Email, Amount, Currency, Status, Reference) and the seller checks them. Buyers become customers (kept with their email). Digital, so no stock. Cedi and other-currency sales are refused. Replace the guesses with a real file from a seller. |
| **Bumpa** | Products, orders, customers and debtors | **Supported, columns guessed (v0.120.0)** | Bumpa's help centre documents how to export (Orders → Export CSV; Customers → Export, an Excel file; Pro and Growth plans) but not the columns, so `bumpa-stock`, `bumpa-sales` and `bumpa-customers` match the likely headings and the seller checks them. Unpaid and part-paid orders go to Money owed; an *Amount Owed* column makes debtors. The customers file is Excel only: save as CSV (no xlsx reader, open question 7). |
| **Paystack transaction export** | Payments received (amount, date, customer email, reference, status) | **Supported (v0.120.0)** | `paystack-sales`: the export is documented (Transactions → Export, emailed when long), its default headings aren't, so they're matched (Reference, Amount, Currency, Status, Channel, Fees, Customer Email, Paid At). Only `success` comes in (reversed, failed, abandoned left out). References starting `na_` (ours, `lib/paystack.ts`) and any already in the books as `online_<ref>` are skipped. Fees become one Bank and POS charges expense a day. |
| **Bank statement (CSV)** | Money in and out | **Supported (v0.120.0)** | A fifth import kind, `bank`: date, narration, reference, money in, money out (or a signed amount, or DR/CR), balance, with the common Nigerian headings (GTBank, Access, Zenith, First Bank, UBA, Opay, Moniepoint, Kuda; not verified with the banks). Each line comes back for the seller to tick: money in as a sale, money out as an expense with a category suggested by simple rules from the narration (not Nana: free). Money in that isn't a sale is left out. PDFs: read in the browser with `pdfjs-dist` when they have text; a scan asks for CSV. |
| **Photo of a paper ledger** | Sales, expenses, debtors from an exercise book | **Not yet** | Nana reads the photo (a vision model, charged to the allowance; Emerald for hard handwriting). Every line goes into the **preview to confirm**, with the ones Nana is unsure of marked. Handwriting won't be read perfectly, so nothing is saved without the seller's check, and the photo is kept with the import for 24 hours so they can compare. Up to 2 pages a time. |
| **Contacts (vCard)** | Customers and suppliers | **Not yet** | A `.vcf` file or the phone's Contact Picker (as Notes Life invites use) to add customers. Names and numbers only. |

**Rules for every import:**
- **Dry run first.** The preview shows new rows, updates, duplicates skipped and rows to fix. Nothing is saved until **Import**.
- **Duplicates:** an app's own order number or reference first (`extRef`, so a re-import adds nothing and an order refunded since
  adds only its refund); then items by SKU (then exact name), sales and expenses by date + amount + item or description. A row that matches is skipped, and the preview says so.
- **Undo for 24 hours:** each import has an id (`bookImports/{id}`), and every entry it made carries it. Undo removes them all and
  puts stock back. After 24 hours, entries are fixed one at a time like any other.
- **Limits:** up to 5,000 rows and 5 MB a file, 10 imports a day. A bigger history goes in parts, a year at a time.
- **Imported items are hidden** in the online store until the seller chooses to show them. Imported past sales are marked "imported"
  and never send receipts, reminders or low-stock alerts for the past.
- **Spreadsheet safety:** exports escape cells that start with `= + - @` (as `lib/inventory.ts` does today).

### Export
- **CSV** of sales, expenses, money owed, suppliers and stock, for any range.
- **Excel (.xlsx)**: one workbook with a sheet each and the P&L on the first sheet. Needs a writer library (open question 7). Until
  then, CSV opens in Excel.
- **PDF report** (P&L for the month, money owed, best sellers) through the print page, as certificates do. Good for a bank or a
  cooperative loan.

## 4. Plans and pricing (proposal, the owner decides)

Today: Inventory is included on Business and Enterprise. On Free Basic and Pro it's a **₦1,500 a month add-on** with a one-time
15-day trial (`lib/pricing.ts`). Free Standard members can't publish, but switching to Free Basic is free.

**Option A: free books with a monthly cap, more on Pro and Business** *(recommended)*

| | Free Basic | Pro (₦5,000) | Business (₦15,000) | Enterprise |
|---|---|---|---|---|
| Walk-in sales and expenses | **150 entries a month** (sales + expenses), then read-only until the 1st | Unlimited | Unlimited | Unlimited |
| Online orders in Books | Always (never count toward the cap) | ✓ | ✓ | ✓ |
| Money owed and suppliers | Up to 20 open customers | Unlimited | Unlimited | Unlimited |
| Reminders and receipts | Members: email and bell. Non-members: WhatsApp click-to-send with the #NotesApp line | Same, with repeating email and bell reminders | + SMS through Send-Na when it's live (pay per SMS, with the #NotesApp line) | Same |
| P&L | Day and week | Day, week, month, any range | Same | Same |
| Receipts (link and PDF) | ✓ | ✓, with logo | ✓ | ✓, white label |
| Import | Templates, up to 500 rows a file | Everything in section 3 | Same | Same + API |
| Export | CSV | CSV, Excel, PDF report | Same | Same + API and MCP |
| Stock linking | With the inventory add-on (₦1,500) or its trial | With the inventory add-on | Included | Included |
| Staff roles | — | — | Cashier and manager (team seats) | Agreed per account |
| Nana entries | From the Nana allowance | Same | Same | Same |
| Monthly email | ✓ | ✓ | ✓ | ✓ |

Why: Tralo is free with "all essential features" (its FAQ). A trader won't pay to *start* keeping books with us. The cap is high
enough for a small trader (about 5 entries a day) and low enough that a busy shop moves to Pro. Pro already brings 30- and 90-day
Analytics and the sales download, so the month P&L and Excel fit there. Staff roles need team seats, which are Business.

**Option B: a "Books" add-on next to Inventory.** Books as a ₦1,500 a month add-on on Free Basic and Pro (with the 15-day trial),
included on Business and Enterprise, or a **₦2,500 "Inventory and Books" bundle**. Simple, and it earns from Free Basic. But it
puts a price in front of the people Tralo gets for free.

**Option C: everything free on every plan.** Earn only from commission on online orders, Nana credit and upgrades for staff and
domains. Fastest growth, but no direct revenue, and heavy free users cost us storage and email.

**Recommendation: Option A.** Keep Inventory exactly as it is (the add-on that turns on stock counting), so nothing already sold
changes. Review the 150 cap after three months of real numbers. The caps and prices go in `lib/pricing.ts` (`books: { freeEntries,
freeCustomers, freeImportRows }`) so Admin → Pricing can change them, as for inventory.

## 5. Data model sketch

Everything below is **server-only** (firestore.rules deny client reads and writes). The page talks to `/api/books`, which checks who
is acting (`canActForSeller`, and the new `books` role) on every call, as inventory does. Money is in kobo, dates are Lagos business
dates (`YYYY-MM-DD`) plus an ISO time.

| Collection | Holds |
|---|---|
| `bookEntries/{id}` | `{ ownerUid, kind: sale \| refund \| expense \| purchase \| money_in \| money_out \| adjust, source: walkin \| online \| nana \| import \| offline, on, at, by, lines: [{ itemId?, variant?, title, qty, unitKobo, costKobo }], totalKobo, paidKobo, method: cash \| transfer \| pos \| card \| wallet \| credit, partyId?, dueOn?, category?, note?, files: [], orderRef?, importId?, clientId, receiptCode?, voidedAt?, voidedBy?, voidReason? }` |
| `bookParties/{id}` | Customers and suppliers: `{ ownerUid, kind: customer \| supplier, name, phone?, email?, memberUid?, balanceKobo, lastPaidAt?, remindersOff? }`. `balanceKobo` is only written by the server, in the same transaction as the entry. |
| `bookDays/{ownerUid_YYYY-MM-DD}`, `bookMonths/{ownerUid_YYYY-MM}` | Running totals (sales, cost, expenses by category, cash in and out, counts), updated in the entry's transaction, so Books home and the P&L read one document instead of hundreds. |
| `bookReceipts/{code}` | What the public receipt page shows: shop name and logo, lines, total, paid, still owed, date. No phone numbers or emails. The code is random (like ticket codes, `lib/tickets.ts`). |
| `bookReminders/{id}` | Each reminder or receipt sent: party, channel (`email \| bell \| whatsapp_link \| whatsapp_api \| sms`), when. For WhatsApp click-to-send it records that WhatsApp was opened, not that the message went. Used for the one-a-day limit and the "reminded 28 Oct" line. |
| `bookImports/{id}` | `{ ownerUid, source, kind, fileName, rows, created: { entries, items, parties }, undoUntil, status }` |
| `bookReports/{uid_YYYY-MM}` | The monthly email, sent once. |
| `users/{uid}.books` | Settings: categories, opening float, whether profit shows in emails, cap counters (`entriesThisMonth`). |
| `orgMembers/{seller_uid}.books` | `"cashier" \| "manager"`. |

**How online orders map in:**
- An order paid → one `bookEntries` sale with `source: online`, `orderRef`, `method: card \| wallet` and the lines at their cost prices,
  plus an expense line for our commission (from the order's ledger entry).
- Its stock is already moved by the order, so the entry never moves it again.
- A refund → a `refund` entry with the same `orderRef`.
- The money is "held by #NotesApp" until the payout releases it (`lib/payouts.ts`), then "paid to your bank". So cash in hand never
  counts online money.
- Written from the order's existing paid and refunded steps, never from the page. A backfill script brings in past orders once,
  marked `source: online`, so the first month isn't empty.

**Rules and tests:** the pure parts (totals, P&L, cash in hand, caps, dedupe, column matching, Nana's parsed-entry checks) live in
`lib/books.ts` and `lib/books-import.ts` with unit tests. Server parts go in `lib/books-server.ts`, and the rules emulator tests go in
`tests/`, as for inventory.

## 6. Competitive notes

Everything here is from Tralo's own public web app (tralo.app, read on 1 November 2026: its page description, FAQ and the templates in
the app), except the activity figures, which came to us in the brief and which we couldn't see on the page (it loads them live).

| | Tralo | #NotesApp with Business books |
|---|---|---|
| What it is | "The complete business operating system for African traders. Manage sales, inventory, documents, payments, and market intelligence … Free. Made in Ghana." | One app for selling **online and in person**: a store with checkout and parcel tracking, Notes Market, bookings, courses, community, your own site, and now the books |
| Price | Free tier with "all essential features"; "Premium features may be available in the future" | Free Basic with a monthly cap (recommended), Pro and Business for more |
| Offline | "An internet connection is required … we're working on offline capabilities for future updates." | Offline entry on phones from the start (section 2) |
| Credit sales | Yes (credit sales, money owed) | Yes, with email and bell reminders, and the customer can pay the debt online |
| Receipts | Shares by WhatsApp, email and SMS | Our own receipt link and PDF. Email and bell to members, WhatsApp to non-members (and SMS with Send-Na), each with a #NotesApp line that invites them to join |
| Import | Inventory CSV (its own template) and a past-sales CSV upload | Section 3: Tralo's own exports, Excel/CSV, Shopify, WooCommerce, Paystack, bank CSV, a paper-ledger photo |
| Export | Sales history, inventory and inventory history as CSV | CSV, Excel and a PDF report |
| Getting paid | — (not checked) | Naira card, transfer and wallet payments, payouts to the seller's bank |
| AI | — (not checked) | Nana records entries from a sentence, reads a paper ledger, and answers "what did I make in October?" |
| Headline numbers | "GH¢100m in business activity" (about GH¢84m inventory, GH¢12.2m sales, GH¢3m expenses), 3,300 businesses, about 1,200 active (as passed to us) | Sales recorded and expenses recorded, counted apart, never with stock value added (section 2, Honest numbers) |

Fair to say: Tralo is free, made for Ghana and already has the basics (sales, stock, credit sales, CSV in and out). We win by being
**one app**: a trader who records a walk-in sale in the morning also sells online, takes a booking, runs a course and gets paid out in
Naira, without moving their data between apps. We also win with offline entry, Nana and honest numbers. We don't yet have cedis or
mobile money. Ghana waits for those (`docs/PAYMENTS.md`).

## 7. Build steps

Each step ships with its tests, help article, changelog line, roadmap update, README and HANDOVER notes (the public-pages rule,
`docs/ENGINEERING_GUIDE.md`), and phone and desktop screenshots from the real code.

1. **This plan and the waitlist** (v0.115.0): the doc, the changelog line, and the public **waitlist** (built, see below). ✓
2. **Mockups for approval**: the screens below. ✓ (approved: "start building books", 2 Nov 2026)
3. **Walk-in sales and expenses**: `lib/books.ts`, `/api/books`, `/profile/books` (Books home, Record a sale, Add expense), receipts
   (link and PDF), online orders flowing in, stock moves, Free Basic cap. Rules and emulator tests. ✓ (v0.118.0)
4. **Profit and loss**: day, week and month, cash in hand, best sellers, running totals, PDF report and CSV. ✓ (v0.118.0; running
   totals not yet, see section 10)
5. **Money owed**: customers and suppliers, record payments, reminders by email and bell (members) and WhatsApp click-to-send with
   the #NotesApp line (non-members, receipts too), paying a debt online (payment kind `debt`). SMS when Send-Na is live. ✓ (v0.118.0;
   paying a debt online and automatic repeat reminders not yet)
6. **Imports**: the wizard, templates, presets (Tralo, Shopify, WooCommerce, Paystack), dry run, dedupe, undo for 24 hours. Excel files
   once the library is approved. Bank CSV and paper-ledger photos last. ✓ for CSV with the Tralo preset (v0.118.0); Shopify,
   WooCommerce, Paystack, bank CSV and photos not yet; Excel files stay out (CSV only, owner 2 Nov)
7. **Nana entries**: typed first, then voice notes. Pearl, metered.
8. **Offline**: the outbox, service-worker caching for Books, sync and conflict flags.
9. **Monthly email**: on the 1st, only with activity.
10. **Staff roles**: cashier and manager on Business and Enterprise.

## 8. Open questions for the owner

Answered on 1 Nov 2026: non-members get receipts and reminders by WhatsApp (and SMS through Send-Na once the seller opts in), each
with a #NotesApp line (section 2). Answered on 2 Nov 2026: 1 (option A, 150), 2 ("Business books"), 3 (only store orders for now) and 6
(CSV only, no library). Still open: 4, 5, 7, 8, 9, 10.

1. **Pricing:** Option A (free with a cap of 150 entries a month), B (a Books add-on or a ₦2,500 bundle with Inventory) or C (all free)?
   And is 150 the right cap?
2. **Name:** "Business books", or "Books", "Shop books" or "My books"? (Books could be confused with e-books in the store.)
3. **Bookings and courses:** should paid bookings, course sales and gifts also flow into Books as income, or only store orders?
4. **Cashiers on Free Basic and Pro:** should a market trader without a Business team be able to add one cashier (a helper seat)?
5. **Paying a debt online:** OK to add a `debt` payment kind, with the seller's normal commission, or no commission because it's an
   offline sale?
6. **Libraries:** may we add a vetted library to read and write Excel files (for example `exceljs` or `read-excel-file` plus a writer)? **Answered (owner, 2 Nov 2026): no.** Sellers save Excel files as CSV (File → Save As → CSV, or Download → CSV in Google Sheets); the wizard and help article say how.
   Without it, import and export are CSV only.
7. **Ghana:** should the Tralo import wait for cedi prices, or come sooner, converting cedis to naira at the day's rate (we'd rather
   not)?
8. **Public numbers:** do we publish totals across sellers at all (sales recorded and expenses recorded), and from when?
9. **Paper ledger photos:** allow Emerald for hard handwriting (dearer, from the allowance), or Pearl only?
10. **The #NotesApp line:** should its link carry the seller's referral code (the seller earns if the customer joins)? And may
    Business and Enterprise sellers (white label) turn the line off?

## 9. Mockups

Static HTML in the app's look (tokens from `tailwind.config.ts` and `app/globals.css`, Newsreader, Manrope, Inter and JetBrains Mono
as `app/layout.tsx` loads them, the "na" mark), rendered at 390×844 (phone) and 1440×900 (desktop), Day and Night. They are kept
outside the repo and shared with the owner for approval:

1. Books home: today's profit, sales, expenses, cash in hand, money owed, low stock and **＋ Record a sale**.
2. Record a sale: item search from inventory, quantities, Cash / Transfer / POS / Credit, the *Customer owes* toggle, receipt link and PDF.
3. Nana entry: "Sold 3 bags of rice ₦45,000 to Mama Bisi on credit" and the parsed entry to confirm.
4. Profit and loss for October.
5. Money owed to you, with **Remind by WhatsApp** and **Send receipt by WhatsApp** (SMS greyed out, "with Send-Na") and a preview of
   the message with the #NotesApp line.
6. The import wizard: choose a source, match columns, preview, import.
7. The monthly summary email.
8. The WhatsApp reminder as the customer sees it (phone).

The example shop is Kemi's Store & Salon in Ojota, Lagos: rice, garri, Ankara, airtime and knotless braids.

## 10. What's built (v0.118.0, 2 Nov 2026)

**Screens** (`/profile/books`, `components/books/`): Today (the crimson profit card, tiles, today's entries, running low, you owe,
best sellers, the Free Basic count), Sales and Expenses (day, week, month; tap an entry for its receipt, photos or Void), Stock,
Money owed (owed to you with the reminder preview and WhatsApp, email and bell; you owe), Profit and loss (PDF through the print
dialog, CSV), Import and export. The two quick sheets, **＋ Record a sale** and **Add expense**, open from anywhere. Phone first
(tabs across the top, a bottom sheet), desktop with the sidebar, Day and Night. Public pages: `/receipt/<code>` (Save as PDF, QR) and
`/statement/<code>` (what a customer owes, with Stop reminders); both on the main site (`middleware.ts` sends them there from the app
address), and neither shows a phone number.

**Collections** (all server-only in `firestore.rules`): `bookEntries`, `bookParties`, `bookItems`, `bookReceipts`, `bookReminders`,
`bookImports`, `bookSettings`. Index: `bookEntries (ownerUid, on)`. Where the build differs from section 5:
- **Settings and the month's count** are in `bookSettings/{uid}`, not `users/{uid}.books`: `users` documents are public and members
  can write parts of their own, so a count there could be read or changed from the browser.
- **`bookItems`** is new: a stock list row that isn't in the online store becomes a Books-only item (a private price list with stock,
  never shown for sale), instead of a hidden store item (store items have no hidden state yet).
- **Running totals** (`bookDays`, `bookMonths`) aren't built yet. Views read the period's entries through the `(ownerUid, on)` index,
  which is fine at today's sizes (Free Basic's 150 a month; a busy Pro shop's month is a few thousand). Add them if months get slow.
- **Statements** use a code on the customer (`bookParties.statementCode`), not a separate collection.
- **Online orders** are written from the paid step (`lib/payments.ts` → `bookOnlineOrder`, ids `online_<ref>` and `online_<ref>_refund`,
  created only if missing) and the admin refund (`app/api/admin/payments/route.ts`), and caught up when Books opens
  (`syncOnlineOrders`: paid orders since the last look, all of them the first time, and any refunded). So no backfill script is needed.
  Commission is a field on the sale (`feeKobo`), shown as the "#NotesApp commission (online orders)" expense line.
- **Customers paying back** are `payment` entries, applied to their oldest sales first (`settleFifo`), and **opening balances** from a
  customers import are `opening` entries. Neither is in the P&L.

**Limits and where they're set:** `lib/pricing.ts` `books { freeEntries: 150, freeCustomers: 20, freeImportRows: 500 }` (Admin →
Pricing → Business books; `test:pricing`); `lib/books.ts`: 5,000 rows and 5 MB a file, 10 imports a day, undo for 24 hours, 3
receipt photos (10 MB each), 50 lines a sale. Rate limits in `/api/books`: 600 calls an hour, 60 reminders an hour, one reminder a
day per customer (`lastRemindedOn`), 120 receipts an hour.

**Who:** the seller and, on an organisation's account (Business and Enterprise), its admins (`canUseBooks`). A teammate with store
access only doesn't see the books. Every entry keeps who recorded it (`by`).

**Imports from other apps (v0.120.0):** Shopify, WooCommerce, Selar, Bumpa, Paystack and bank statements, in the table in section
3 (which headings are verified and which guessed). Fixtures for each in `tests/books/fixtures/`.

**Tests:** `test:books` (kobo maths, periods, P&L, cash in hand, the caps, paying back, debtors, the WhatsApp messages, CSV reading,
column matching, the Tralo preset, dedupe, templates) and `test:books-server` (permissions, a sale with its receipt and stock moves,
expenses, paying back, reminders by WhatsApp and email with the daily limit and stop, online orders and refunds, P&L, the Free
Basic caps, imports with dry run, duplicates and undo, export); rules in `test:rules`. All in CI.

**Next (steps 7 to 10, and what was left out of 3 to 6):** Nana entries; offline entry (the outbox); the monthly summary email
(`bookReports`); staff roles (`orgMembers.books`: cashier and manager); paying a debt online (payment kind `debt`, open question 5);
automatic repeat reminders and "remind again" prompts; the supplier bell the day before a due date; repeating expenses; the opening
float and count-the-drawer screen (the float is stored, `bookSettings.floatKobo`, with no screen yet); a purchase (restock) entry from
Books; any-range P&L; paper-ledger photos and vCard contacts; the referral code
on the #NotesApp line (open question 10); running totals; SMS when Send-Na is live; the waitlist page (`/books`) saying it's open.

