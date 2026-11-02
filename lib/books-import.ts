// Business books imports (docs/BUSINESS-BOOKS.md section 3): one wizard for every kind. Pure: the column matching (guessed from the
// headings, or a preset for another app's export), reading each row into a clean record, the duplicate keys and the templates. The server
// (lib/books-server.ts) runs the dry run and the import, and keeps each import's id so it can be undone for 24 hours.
//
// CSV only (owner, 2 Nov 2026): no Excel library. Excel and Google Sheets save as CSV (the help article shows how). A bank statement PDF
// is read in the browser with pdfjs-dist (already used by components/PdfViewer.tsx) into the same columns, see statementFromPdfLines.
import { parseCsv } from "./inventory";
import { BOOKS_IMPORT_MAX_BYTES, BOOKS_IMPORT_MAX_ROWS, DEFAULT_CATEGORIES, cleanText, isDay, lagosDay, toKobo, waPhone, type Method } from "./books";

export type ImportKind = "stock" | "sales" | "expenses" | "customers" | "bank";
export const IMPORT_KINDS: { id: ImportKind; label: string; hint: string }[] = [
  { id: "stock", label: "Stock list", hint: "Items, prices, cost prices and how many you have" },
  { id: "sales", label: "Sales", hint: "Past sales, with credit sales becoming money owed" },
  { id: "expenses", label: "Expenses", hint: "What you spent, by category" },
  { id: "customers", label: "Customers and debtors", hint: "Names, phone numbers and what they owe you" },
  { id: "bank", label: "Bank statement", hint: "Money in and out: you choose what each line is" },
];
export const isImportKind = (v: unknown): v is ImportKind => IMPORT_KINDS.some((k) => k.id === v);

// Each kind's fields, and the headings that usually mean them (lower case, with spaces and punctuation taken out when compared).
type Field = { id: string; label: string; required?: boolean; words: string[] };
export const FIELDS: Record<ImportKind, Field[]> = {
  stock: [
    { id: "name", label: "Item name", required: true, words: ["name", "item", "item name", "product", "product name", "title", "description"] },
    { id: "sku", label: "SKU (to match)", words: ["sku", "barcode", "code", "item code", "product code", "item_id", "variant sku"] },
    { id: "category", label: "Category", words: ["category", "categories", "group", "type"] },
    { id: "price", label: "Price (₦)", words: ["price", "selling price", "sale price", "unit price", "retail price", "price naira", "price_naira", "variant price", "regular price"] },
    { id: "cost", label: "Cost price (₦)", words: ["cost", "cost price", "buying price", "purchase price", "cost naira", "cost_naira", "unit cost", "cost per item", "cost of goods"] },
    { id: "stock", label: "Stock", words: ["stock", "qty", "quantity", "stock quantity", "in stock", "quantity in stock", "count", "on hand", "inventory quantity", "variant inventory qty"] },
    { id: "unit", label: "Unit", words: ["unit", "uom", "unit of measure"] },
    { id: "lowAt", label: "Low-stock level", words: ["low stock", "low stock at", "low_stock_at", "reorder level", "reorder point", "alert at", "minimum", "low stock amount"] },
    { id: "variant", label: "Option (size, colour)", words: ["variant", "variant name", "option", "option1 value"] },
    { id: "variant2", label: "Second option", words: ["option2 value"] },
    { id: "variant3", label: "Third option", words: ["option3 value"] },
    { id: "group", label: "Product handle or parent (options)", words: ["handle", "url handle", "parent", "parent id"] },
    { id: "extId", label: "Product ID", words: ["id", "product id"] },
    { id: "type", label: "Product type (variable is skipped)", words: [] },
  ],
  sales: [
    { id: "date", label: "Date", required: true, words: ["date", "sale date", "day", "created", "created at", "sold on", "order date", "paid at", "transaction date"] },
    { id: "time", label: "Time", words: ["time"] },
    { id: "item", label: "Item or description", words: ["item", "product", "product name", "product_name", "description", "details", "name", "title", "what", "lineitem name", "item name", "items"] },
    { id: "qty", label: "Quantity", words: ["qty", "quantity", "units", "count", "lineitem quantity", "item quantity"] },
    { id: "unitPrice", label: "Price each (₦)", words: ["unit price", "unit_price", "price", "rate", "price each", "lineitem price", "item cost"] },
    { id: "lineTotal", label: "Line total (₦)", words: ["line total", "item total", "item_total"] },
    { id: "total", label: "Total (₦)", words: ["total", "amount", "total amount", "sale amount", "value", "order total", "order total amount"] },
    { id: "paid", label: "Amount paid (₦)", words: ["paid", "amount paid", "amount_paid", "deposit", "paid now"] },
    { id: "due", label: "Still to pay (₦)", words: ["outstanding balance", "balance due", "amount due", "still to pay", "balance"] },
    { id: "method", label: "Paid how", words: ["payment method", "payment_method", "method", "paid by", "payment", "mode", "channel", "payment channel"] },
    { id: "customer", label: "Customer", words: ["customer", "customer name", "customer_name", "buyer", "buyer name", "client", "billing name"] },
    { id: "lastName", label: "Customer's surname", words: ["last name", "surname", "billing last name"] },
    { id: "phone", label: "Customer phone", words: ["phone", "customer phone", "customer_phone", "mobile", "phone number", "whatsapp", "billing phone"] },
    { id: "email", label: "Customer email", words: ["email", "customer email", "buyer email", "billing email", "e-mail"] },
    { id: "dueOn", label: "Due date", words: ["due", "due date", "due_date", "pay by"] },
    { id: "note", label: "Note", words: ["note", "notes", "remark", "remarks", "comment"] },
    { id: "ref", label: "Order or reference no.", words: ["reference", "ref", "order number", "order no", "order id", "order_number", "transaction id", "transaction reference", "invoice number", "receipt no"] },
    { id: "status", label: "Status (only paid ones come in)", words: ["status", "payment status", "financial status", "order status", "transaction status"] },
    { id: "currency", label: "Currency (naira only)", words: ["currency", "order currency"] },
    { id: "refunded", label: "Refunded (₦)", words: ["refunded", "refunded amount", "refund amount", "amount refunded", "refunded total"] },
    { id: "fee", label: "Payment fees (₦)", words: ["fee", "fees", "transaction fee", "paystack fee"] },
  ],
  expenses: [
    { id: "date", label: "Date", required: true, words: ["date", "day", "paid on", "expense date"] },
    { id: "amount", label: "Amount (₦)", required: true, words: ["amount", "total", "cost", "value", "spent"] },
    { id: "category", label: "Category", words: ["category", "type", "group", "account"] },
    { id: "description", label: "Description", words: ["description", "details", "item", "what", "note", "notes", "narration", "memo"] },
    { id: "method", label: "Paid how", words: ["payment method", "method", "paid by", "payment", "mode"] },
  ],
  customers: [
    { id: "name", label: "Name", required: true, words: ["name", "customer", "customer name", "full name", "client"] },
    { id: "phone", label: "Phone", words: ["phone", "mobile", "phone number", "whatsapp", "number"] },
    { id: "email", label: "Email", words: ["email", "e-mail", "email address"] },
    { id: "owes", label: "Owes you (₦)", words: ["owes", "balance", "amount owed", "debt", "outstanding", "owing", "amount due"] },
    { id: "dueOn", label: "Due date", words: ["due", "due date", "pay by"] },
    { id: "note", label: "Note", words: ["note", "notes", "for", "what for", "description"] },
  ],
  bank: [
    { id: "date", label: "Date", required: true, words: ["date", "trans date", "tran date", "transaction date", "posted date", "post date", "date posted", "trans time", "date time", "txn date", "value date"] },
    { id: "narration", label: "Narration", required: true, words: ["narration", "description", "details", "remarks", "transaction details", "particulars", "memo", "transaction description"] },
    { id: "ref", label: "Reference", words: ["reference", "ref", "ref no", "transaction reference", "reference number", "session id"] },
    { id: "credit", label: "Money in (₦)", words: ["credit", "credits", "money in", "lodgement", "lodgements", "deposit", "deposits", "inflow", "credit amount", "cr"] },
    { id: "debit", label: "Money out (₦)", words: ["debit", "debits", "money out", "withdrawal", "withdrawals", "outflow", "debit amount", "dr"] },
    { id: "amount", label: "Amount (− for money out)", words: ["amount", "transaction amount"] },
    { id: "drcr", label: "DR or CR", words: ["dr cr", "cr dr", "drcr", "debit credit", "transaction type"] },
    { id: "balance", label: "Balance", words: ["balance", "balance after", "closing balance", "available balance", "running balance"] },
  ],
};
const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
export const fieldLabel = (kind: ImportKind, id: string) => FIELDS[kind].find((f) => f.id === id)?.label ?? "Don't import";

// ---- Where a file comes from ----
// Each source: the kinds it brings, how sure we are of its export's headings, and the steps to export it (shown in the wizard).
//   verified: "yes" = the headings are from the source's own documentation; "partly" = the export is documented but not every heading;
//   "no" = we couldn't check them, so the wizard says "we matched your columns; check them".
export type SourceId = "csv" | "sheets" | "tralo" | "shopify" | "woo" | "selar" | "bumpa" | "paystack" | "bank";
export type SourceGuide = { id: SourceId; label: string; hint: string; icon: string; kinds: ImportKind[]; verified: "yes" | "partly" | "no"; steps: string[]; url?: string; note?: string; excel?: string };
export const SOURCES: SourceGuide[] = [
  { id: "csv", label: "Excel or CSV", hint: "Stock list, sales, expenses, customers, debtors", icon: "", kinds: ["stock", "sales", "expenses", "customers"], verified: "yes", steps: ["Download a template below, or use your own sheet with a heading on each column.", "In Excel: File → Save As → CSV (Comma delimited).", "Upload it here and check the columns we matched."] },
  { id: "sheets", label: "Google Sheets", hint: "File → Download → CSV, then upload", icon: "GS", kinds: ["stock", "sales", "expenses", "customers"], verified: "yes", steps: ["Open the sheet in Google Sheets.", "File → Download → Comma-separated values (.csv).", "Upload that file here."] },
  { id: "tralo", label: "Tralo", hint: "Its inventory and sales CSV exports", icon: "TR", kinds: ["stock", "sales"], verified: "yes", url: "https://tralo.app", steps: ["In Tralo on the web, open Inventory (or Sales history).", "Choose Export → CSV.", "Upload the file here: we know Tralo's columns."] },
  { id: "shopify", label: "Shopify", hint: "Products and Orders CSV exports", icon: "SH", kinds: ["stock", "sales"], verified: "yes", url: "https://help.shopify.com/en/manual/products/import-export/using-csv", steps: ["Products: in Shopify admin, Products → Export → All products → CSV for Excel, Numbers or other spreadsheet programs.", "Orders: Orders → Export → choose the dates → CSV for Excel. Shopify emails big exports to you.", "Upload one file at a time here. Each option (size, colour) becomes its own item; only paid orders come in, and refunded ones come in with their refund."], note: "Naira orders only: a file with orders in dollars or another currency is refused, so export a naira store's orders." },
  { id: "woo", label: "WooCommerce", hint: "Product CSV; orders through an export plugin", icon: "WC", kinds: ["stock", "sales"], verified: "partly", url: "https://github.com/woocommerce/woocommerce/wiki/Product-CSV-Import-Schema", steps: ["Products: in WordPress, Products → All Products → Export → Generate CSV.", "Orders: WooCommerce has no built-in orders CSV. Use an export plugin: WooCommerce's “Customer / Order / Coupon Export” (choose the “one row per item” format) or “Advanced Order Export For WooCommerce”, then export as CSV.", "Upload it here. Completed and processing orders come in; refunded ones come in with their refund."], note: "Orders come from a plugin, so we matched your columns; check them." },
  { id: "selar", label: "Selar", hint: "Sales export, with buyers as customers", icon: "SE", kinds: ["sales"], verified: "no", url: "https://selar.com", steps: ["On selar.com, open your dashboard → Sales (or Transactions).", "Export or download the list as CSV. If it gives you Excel, open it and save as CSV.", "Upload it here. Each buyer becomes a customer; Selar items are digital, so no stock moves."], note: "We couldn't check Selar's export headings, so we matched your columns; check them." },
  { id: "bumpa", label: "Bumpa", hint: "Products, orders and customers exports", icon: "BU", kinds: ["stock", "sales", "customers"], verified: "partly", url: "https://support.getbumpa.com/support/solutions/articles/150000182553-exporting-orders", steps: ["Orders: in the Bumpa dashboard, Orders → Export CSV (Pro and Growth plans).", "Customers: Customers → Export (top right). Bumpa gives an Excel file: open it and save as CSV.", "Products: Products → Export, then save as CSV if it opens in Excel.", "Upload one file at a time here. Unpaid orders become money owed."], note: "Bumpa documents how to export but not the columns, so we matched your columns; check them.", excel: "Bumpa's customer export is an Excel file. Open it in Excel or Google Sheets and save it as CSV, then upload that." },
  { id: "paystack", label: "Paystack", hint: "Transactions → Export CSV", icon: "PS", kinds: ["sales"], verified: "partly", url: "https://support.paystack.com/hc/en-us/articles/360009973319-How-do-I-export-my-transaction-data-", steps: ["In the Paystack dashboard, open Transactions.", "Filter to the dates you want (Status: Successful), then Export → CSV. Keep the default columns (reference, amount, status, channel, fees, customer email, date).", "Very long histories are emailed as a link: download the file, then upload it here."], note: "Only successful payments come in. Payments that were #NotesApp orders are skipped (they're already in your books), and Paystack's fees become an expense under Bank and POS charges." },
  { id: "bank", label: "Bank statement", hint: "CSV from your bank app (PDF if it has text)", icon: "₦", kinds: ["bank"], verified: "no", steps: ["In your bank app or internet banking, download your statement for the dates you want as CSV (or Excel, then save as CSV).", "A PDF statement works if it was made by the bank (not a scan or photo). If we can't read it, export CSV from your bank app.", "You choose what each line is: money in from a sale, an expense, or leave it out. Nothing is saved until you import."], note: "Banks lay statements out differently (GTBank, Access, Zenith, First Bank, UBA, Opay, Moniepoint, Kuda), so we matched your columns; check them." },
];
export const sourceOf = (id: unknown) => SOURCES.find((s) => s.id === id);

// Presets: an app's own export, whose headings we know (or, where it isn't documented, the headings it most likely uses). `only` leaves
// every other heading out instead of guessing it (for exports with many columns we know). Rules change how rows are read.
export type PresetRules = { statuses?: "shop" | "paystack"; online?: boolean; ourRefs?: boolean; clampStock?: boolean; title?: string; digital?: boolean };
export type Preset = { id: string; source: SourceId; label: string; kind: ImportKind; columns: Record<string, string>; only?: boolean; rules?: PresetRules; detect?: string[][] };
// References #NotesApp itself gives Paystack payments (lib/paystack.ts newReference: `na_<time>_<hex>`). Orders are also in the books as
// bookEntries/online_<reference>, which the server checks.
export const OUR_REF_PREFIXES = ["na_"];
export const PRESETS: Preset[] = [
  // Tralo (tralo.app, read 1 Nov 2026): inventory "Product Name, Category, Cost Price, Selling Price, Stock Quantity, Unit"; sales "date,
  // time, product_name, quantity, unit_price, customer_name, customer_phone, payment_method, amount_paid, apply_taxes, notes".
  { id: "tralo-stock", source: "tralo", label: "Tralo inventory export", kind: "stock", columns: { "Product Name": "name", Category: "category", "Cost Price": "cost", "Selling Price": "price", "Stock Quantity": "stock", Unit: "unit" }, detect: [["productname", "costprice", "sellingprice", "stockquantity"]] },
  { id: "tralo-sales", source: "tralo", label: "Tralo sales export", kind: "sales", columns: { date: "date", time: "time", product_name: "item", quantity: "qty", unit_price: "unitPrice", customer_name: "customer", customer_phone: "phone", payment_method: "method", amount_paid: "paid", apply_taxes: "", notes: "note" }, detect: [["productname", "unitprice", "paymentmethod", "amountpaid", "applytaxes"]] },
  // Shopify products CSV (help.shopify.com/en/manual/products/import-export/using-csv, read 2 Nov 2026). Today's export: "Title, URL handle,
  // Description, Vendor, Product category, Type, Tags, Published on online store, Status, SKU, Barcodes, Option1 name, Option1 value, …,
  // Price, Compare-at price, Cost per item, Charge tax, Inventory tracker, Inventory quantity, …". The older export (still common): "Handle,
  // Title, Body (HTML), Vendor, Type, Tags, Published, Option1 Name, Option1 Value, …, Variant SKU, …, Variant Inventory Qty, …, Variant
  // Price, Variant Compare At Price, …, Cost per item". A product with options has one row per option under the same handle, with the
  // Title left empty on the extra rows; a product without options has Option1 value "Default Title". Rows with only an image are skipped.
  {
    id: "shopify-stock", source: "shopify", label: "Shopify products export", kind: "stock", only: true, rules: { clampStock: true },
    columns: { Handle: "group", "URL handle": "group", Title: "name", "Option1 Value": "variant", "Option2 Value": "variant2", "Option3 Value": "variant3", "Variant SKU": "sku", SKU: "sku", "Variant Price": "price", Price: "price", "Variant Inventory Qty": "stock", "Inventory quantity": "stock", "Cost per item": "cost", Type: "category" },
    detect: [["handle", "title", "variantprice"], ["urlhandle", "title", "price", "inventoryquantity"], ["handle", "title", "variantsku"]],
  },
  // Shopify orders CSV (help.shopify.com/en/manual/fulfillment/managing-orders/exporting-orders, read 2 Nov 2026): "Name, Email, Financial
  // Status, Paid at, Fulfillment Status, …, Currency, Subtotal, Shipping, Taxes, Total, Discount Code, Discount Amount, Shipping Method,
  // Created at, Lineitem quantity, Lineitem name, Lineitem price, Lineitem compare-at price, Lineitem SKU, …, Billing Name, …, Billing
  // Phone, …, Notes, …, Payment Method, …, Refunded Amount, Vendor, Outstanding Balance, …, Id, Tags, …". Each extra line item is its own
  // row with the order's fields left empty. Financial Status (shopify.dev Order financial_status): pending, authorized, partially_paid,
  // paid, partially_refunded, refunded, voided.
  {
    id: "shopify-sales", source: "shopify", label: "Shopify orders export", kind: "sales", only: true, rules: { statuses: "shop", online: true, title: "Shopify order" },
    columns: { Name: "ref", "Created at": "date", "Financial Status": "status", "Lineitem name": "item", "Lineitem quantity": "qty", "Lineitem price": "unitPrice", Total: "total", Currency: "currency", Email: "email", "Billing Name": "customer", "Billing Phone": "phone", "Refunded Amount": "refunded", "Outstanding Balance": "due", "Payment Method": "method", Notes: "note" },
    detect: [["name", "financialstatus", "lineitemname"]],
  },
  // WooCommerce's built-in product exporter (the Product CSV Import Schema, github.com/woocommerce/woocommerce/wiki, read 2 Nov 2026):
  // "ID, Type, SKU, Name, Published, Is featured?, …, In stock?, Stock, Low stock amount, …, Sale price, Regular price, Categories, Tags,
  // …, Parent, …". Type is simple, variable, variation, grouped or external; a variation's Parent is "id:123" or the parent's SKU. The
  // variable product itself carries no stock, so it's skipped and its variations come in as items.
  {
    id: "woo-stock", source: "woo", label: "WooCommerce product export", kind: "stock", only: true, rules: { clampStock: true },
    columns: { ID: "extId", Type: "type", SKU: "sku", Name: "name", "Regular price": "price", Stock: "stock", "Low stock amount": "lowAt", Categories: "category", Parent: "group", "Attribute 1 value(s)": "variant", "Attribute 2 value(s)": "variant2", "Cost of goods": "cost" },
    detect: [["id", "type", "sku", "name", "regularprice"]],
  },
  // WooCommerce orders have no built-in CSV. Two common plugins (their headings aren't all documented, so these are matched and the
  // seller checks them): WooCommerce's "Customer / Order / Coupon Export", one row per item (order_number, date, status, order_total,
  // refunded_total, order_currency, payment_method, billing_first_name, billing_last_name, billing_email, billing_phone, item_name,
  // item_quantity, item_total, customer_note), and "Advanced Order Export For WooCommerce" (Order Number, Order Date, Order Status,
  // First Name (Billing), Last Name (Billing), Email (Billing), Phone (Billing), Payment Method Title, Order Refund Amount, Order Total
  // Amount, Item Name, Quantity, Item Cost). Woo statuses: pending, processing, on-hold, completed, cancelled, refunded, failed.
  {
    id: "woo-sales", source: "woo", label: "WooCommerce order export (plugin)", kind: "sales", only: true, rules: { statuses: "shop", online: true, title: "WooCommerce order" },
    columns: {
      order_number: "ref", order_id: "ref", date: "date", order_date: "date", status: "status", order_total: "total", refunded_total: "refunded", order_currency: "currency", payment_method: "method", payment_method_title: "method", billing_first_name: "customer", billing_last_name: "lastName", billing_email: "email", billing_phone: "phone", item_name: "item", item_quantity: "qty", item_total: "lineTotal", customer_note: "note",
      "Order Number": "ref", "Order Date": "date", "Order Status": "status", "First Name (Billing)": "customer", "Last Name (Billing)": "lastName", "Email (Billing)": "email", "Phone (Billing)": "phone", "Payment Method Title": "method", "Order Refund Amount": "refunded", "Order Total Amount": "total", "Item Name": "item", Quantity: "qty", "Item Cost": "unitPrice", Currency: "currency",
    },
    detect: [["ordernumber", "status", "ordertotal", "itemname"], ["orderid", "ordertotal", "itemname"], ["ordernumber", "orderstatus", "ordertotalamount"]],
  },
  // Selar (selar.com): its sales export isn't documented anywhere we could find (2 Nov 2026), so these are the headings it most likely
  // uses, and the seller checks the match. Selar sells digital items, so no stock moves, and it sells in several currencies.
  {
    id: "selar-sales", source: "selar", label: "Selar sales export", kind: "sales", rules: { statuses: "shop", online: true, title: "Selar sale", digital: true },
    columns: { Date: "date", "Date Created": "date", Product: "item", "Product Name": "item", "Buyer Name": "customer", "Customer Name": "customer", "Buyer Email": "email", "Customer Email": "email", "Buyer Phone": "phone", Amount: "total", Price: "unitPrice", Quantity: "qty", Currency: "currency", Status: "status", "Payment Status": "status", Reference: "ref", "Transaction ID": "ref", "Order ID": "ref", Earnings: "", Commission: "" },
  },
  // Bumpa (getbumpa.com): its help centre says how to export (Orders → Export CSV; Customers → Export, an Excel file) but not the
  // columns (support.getbumpa.com articles 150000182553 and 150000182549, read 2 Nov 2026). Matched and checked by the seller.
  { id: "bumpa-stock", source: "bumpa", label: "Bumpa products export", kind: "stock", rules: { clampStock: true }, columns: { Name: "name", "Product Name": "name", SKU: "sku", Price: "price", "Selling Price": "price", "Cost Price": "cost", Quantity: "stock", Stock: "stock", Category: "category", Variant: "variant", "Variant Name": "variant" } },
  { id: "bumpa-sales", source: "bumpa", label: "Bumpa orders export", kind: "sales", rules: { statuses: "shop", title: "Bumpa order" }, columns: { "Order ID": "ref", "Order Number": "ref", Date: "date", "Order Date": "date", "Customer Name": "customer", "Customer Phone": "phone", "Customer Email": "email", Product: "item", Items: "item", Quantity: "qty", Total: "total", "Amount Paid": "paid", Balance: "due", "Payment Status": "status", "Payment Method": "method", Status: "", Channel: "" } },
  { id: "bumpa-customers", source: "bumpa", label: "Bumpa customers export", kind: "customers", columns: { Name: "name", "Customer Name": "name", Phone: "phone", "Phone Number": "phone", Email: "email", "Amount Owed": "owes", Balance: "owes", "Total Spent": "", Orders: "" } },
  // Paystack transactions export (support.paystack.com article 360009973319, read 2 Nov 2026): Dashboard → Transactions → Export, with
  // a default set of columns the seller can change; very long histories are emailed. The help centre doesn't list the headings, so these
  // are the ones the export shows by default (reference, amount, currency, status, channel, fees, customer email and name, paid at),
  // matched and checked. Statuses: success, failed, abandoned, reversed and pending ones; only success comes in.
  {
    id: "paystack-sales", source: "paystack", label: "Paystack transactions export", kind: "sales", rules: { statuses: "paystack", online: true, ourRefs: true, title: "Paystack payment" },
    columns: { Reference: "ref", "Transaction Reference": "ref", Amount: "total", "Amount Paid": "total", Currency: "currency", Status: "status", Channel: "method", "Payment Channel": "method", Fees: "fee", Fee: "fee", "Customer Email": "email", Email: "email", "Customer Name": "customer", "Customer Phone": "phone", "Paid At": "date", "Transaction Date": "date", "Created At": "date", Date: "date" },
    detect: [["reference", "channel", "status", "amount"], ["reference", "channel", "paidat"]],
  },
  // Bank statements: banks don't publish their CSV layouts. The headings below are the common ones on Nigerian statements (GTBank "Trans.
  // Date, Value Date, Reference, Debits, Credits, Balance, Remarks"; Access and Zenith "Posted Date / Date Posted, Value Date, Description,
  // Debit, Credit, Balance"; First Bank and UBA "Tran Date, Narration, Debit, Credit, Balance"; Opay "Trans. Time, Value Date, Description,
  // Debit(₦), Credit(₦), Balance After(₦), Channel, Transaction Reference"; Moniepoint "Date, Narration, Reference, Debit, Credit,
  // Balance"; Kuda "Date/Time, Money In, Money out, Category, To / From, Description, Balance"), not checked against the banks' own
  // documents, so the wizard asks the seller to check the match. Detected by detectSource from date + narration + money columns.
  { id: "bank-statement", source: "bank", label: "Bank statement", kind: "bank", columns: {} },
];
export const presetOf = (id: unknown) => PRESETS.find((p) => p.id === id);
export const presetFor = (source: string, kind: ImportKind) => PRESETS.find((p) => p.source === source && p.kind === kind);

// Which app a file came from, from its headings (exact presets first, then a bank statement's shape). null when we can't tell.
export function detectSource(headers: string[]): Preset | null {
  const have = new Set(headers.map(squash));
  for (const p of PRESETS) if (p.detect?.some((sig) => sig.every((h) => have.has(h)))) return p;
  const any = (ws: string[]) => ws.some((w) => have.has(squash(w)));
  const dated = [...have].some((h) => h.includes("date") || h === "transtime" || h === "datetime");
  const narr = any(["narration", "description", "remarks", "details", "particulars", "transaction details"]);
  const money = (any(["debit", "debits", "debit(₦)"]) && any(["credit", "credits"])) || (any(["money in"]) && any(["money out"])) || (any(["withdrawals"]) && any(["lodgements", "deposits"])) || ([...have].some((h) => h.startsWith("balance")) && any(["amount", "debit", "credit"]));
  if (dated && narr && money) return presetOf("bank-statement")!;
  return null;
}

// The column each heading goes into ("" = don't import): the preset's, else the closest heading words, each field used once.
export type Mapping = string[];
export function guessMapping(headers: string[], kind: ImportKind, preset?: Preset): Mapping {
  const used = new Set<string>(), fixed = new Set<number>();
  const out = headers.map(() => "");
  if (preset && preset.kind === kind) {
    // The preset's columns (including ones it leaves out on purpose); any other heading is guessed as usual, unless the preset says not to.
    const byHead = new Map(Object.entries(preset.columns).map(([h, f]) => [squash(h), f]));
    headers.forEach((h, i) => { const f = byHead.get(squash(h)); if (f === undefined) { if (preset.only) fixed.add(i); return; } fixed.add(i); if (f && !used.has(f)) { out[i] = f; used.add(f); } });
  }
  // Exact heading words first, then a heading that contains a field's word (longest words first, so "cost price" beats "price").
  const words = FIELDS[kind].flatMap((f) => f.words.map((w) => ({ f: f.id, w: squash(w) }))).sort((a, b) => b.w.length - a.w.length);
  headers.forEach((h, i) => { if (fixed.has(i)) return; const s = squash(h); const hit = words.find((x) => x.w === s && !used.has(x.f)); if (hit) { out[i] = hit.f; used.add(hit.f); } });
  headers.forEach((h, i) => { if (out[i] || fixed.has(i)) return; const s = squash(h); const hit = words.find((x) => x.w.length >= 3 && s.includes(x.w) && !used.has(x.f)); if (hit) { out[i] = hit.f; used.add(hit.f); } });
  return out;
}
export function cleanMapping(raw: unknown, headers: string[], kind: ImportKind): Mapping {
  const ids = new Set(FIELDS[kind].map((f) => f.id));
  const arr = Array.isArray(raw) ? raw : [];
  const used = new Set<string>();
  return headers.map((_, i) => { const f = String(arr[i] ?? ""); if (!ids.has(f) || used.has(f)) return ""; used.add(f); return f; });
}
export function missingRequired(m: Mapping, kind: ImportKind): string[] {
  const out = FIELDS[kind].filter((f) => f.required && !m.includes(f.id)).map((f) => f.label);
  // A sale needs what was sold, or a reference to name it by (a Paystack payment has no item).
  if (kind === "sales" && !m.includes("item") && !m.includes("ref")) out.push("Item or description");
  if (kind === "bank" && !m.includes("credit") && !m.includes("debit") && !m.includes("amount")) out.push("Money in, money out or amount");
  return out;
}

// ---- Reading the file ----
export type Sheet = { headers: string[]; rows: string[][] };
export function readSheet(text: string): Sheet | { error: string } {
  if (text.length > BOOKS_IMPORT_MAX_BYTES) return { error: `That file is too big: up to ${BOOKS_IMPORT_MAX_BYTES / 1024 / 1024} MB. Split it, a year at a time.` };
  const all = parseCsv(text.replace(/^﻿/, ""));
  if (!all.length) return { error: "The file is empty." };
  // Bank exports often put the account name and period above the table: start at the first row that looks like headings.
  // Only when the first row isn't a heading row itself (fewer than 3 cells filled in).
  const filled = (r: string[]) => r.filter((x) => x.trim()).length;
  let h = 0;
  if (filled(all[0]) < 3) for (let i = 1; i < Math.min(all.length, 20); i++) { if (filled(all[i]) >= 3 && all[i].some((x) => x.length < 25 && /date|time/i.test(x))) { h = i; break; } }
  const headers = all[h].map((x) => x.trim());
  if (!headers.some(Boolean)) return { error: "The first row needs the column headings." };
  const rows = all.slice(h + 1);
  if (rows.length > BOOKS_IMPORT_MAX_ROWS) return { error: `That file has ${rows.length.toLocaleString("en-NG")} rows: up to ${BOOKS_IMPORT_MAX_ROWS.toLocaleString("en-NG")} at a time. Split it, a year at a time.` };
  return { headers, rows };
}

// Dates as people and apps write them: 2026-10-12, 12/10/2026 and 12/10/26 (day first, as in Nigeria and Ghana), 12-10-2026,
// 12 Oct 2026, 12-OCT-26, Oct 12 2026, each optionally followed by a time.
const MON = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
export function parseDay(v: string): string | null {
  const s = v.trim().toLowerCase().replace(/(\d)(st|nd|rd|th)\b/g, "$1").replace(/,/g, " ").replace(/\s+/g, " ");
  if (!s) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  const ok = (y: number, m: number, d: number) => { const day = `${y < 100 ? 2000 + y : y}-${pad(m)}-${pad(d)}`; return isDay(day) ? day : null; };
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ t].*)?$/);
  if (m) return ok(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})(?: .*)?$/);
  if (m) return ok(+m[3], +m[2], +m[1]);
  m = s.match(/^(\d{1,2})[ -]([a-z]{3})[a-z]*[ -](\d{2}|\d{4})(?: .*)?$/);
  if (m && MON.includes(m[2])) return ok(+m[3], MON.indexOf(m[2]) + 1, +m[1]);
  m = s.match(/^([a-z]{3})[a-z]* (\d{1,2}) (\d{4})(?: .*)?$/);
  if (m && MON.includes(m[1])) return ok(+m[3], MON.indexOf(m[1]) + 1, +m[2]);
  return null;
}
// A date and, if there is one, the time (HH:MM, Lagos). A time with a zone (2026-10-12 14:05:33 +0100, or …Z) is moved to Lagos.
export function parseWhen(v: string): { on: string; hm?: string } | null {
  const s = v.trim();
  const z = s.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?\s*(Z|UTC|[+-]\d{2}:?\d{2})$/i);
  if (z) {
    const zone = /^(z|utc)$/i.test(z[5]) ? "Z" : z[5].replace(/^([+-]\d{2})(\d{2})$/, "$1:$2");
    const t = Date.parse(`${z[1]}T${z[2]}:${z[3]}:${z[4] ?? "00"}${zone}`);
    if (Number.isFinite(t)) { const lagos = new Date(t + 3_600_000).toISOString(); return { on: lagosDay(new Date(t)), hm: lagos.slice(11, 16) }; }
  }
  const on = parseDay(s);
  if (!on) return null;
  const tm = s.replace(/^\d{4}-\d{2}-\d{2}/, "").match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)?/i);
  if (!tm) return { on };
  let h = +tm[1];
  if (tm[3]) h = (h % 12) + (/pm/i.test(tm[3]) ? 12 : 0);
  return h < 24 ? { on, hm: `${String(h).padStart(2, "0")}:${tm[2]}` } : { on };
}
// How it was paid, in the words apps and people use. Credit means on credit (owed).
export function parseMethod(v: string): Method | "credit" | null {
  const s = v.trim().toLowerCase();
  if (!s) return null;
  if (/credit|owe|later|debt/.test(s) && !/credit card/.test(s)) return "credit";
  if (/cash/.test(s)) return "cash";
  if (/pos|card|terminal/.test(s)) return "pos";
  if (/transfer|bank|mobile ?money|momo|ussd|opay|palmpay|moniepoint|kuda/.test(s)) return "transfer";
  return null;
}
// A sale's status in the words shops and payment apps use. Paystack: only "success". Shops: paid, completed and processing (paid,
// waiting to be sent) are sales; partially_paid is part paid; refunded and partially_refunded come in with a refund; unpaid is owed
// (Bumpa); pending, authorized, on-hold, cancelled, failed, voided, abandoned, reversed and anything else are left out.
export type SaleStatus = "sale" | "part" | "credit" | "refund" | "partRefund" | "skip";
export function saleStatus(v: string, paystack = false): SaleStatus | null {
  const s = v.trim().toLowerCase().replace(/^wc-/, "").replace(/[\s-]+/g, "_");
  if (!s) return null;
  if (paystack) return /^(success|successful)$/.test(s) ? "sale" : "skip";
  if (/^(paid|success|successful|succeeded|completed?|processing|delivered|fulfilled|closed|approved|settled|confirmed)$/.test(s)) return "sale";
  if (/^(partially_paid|part_paid|partly_paid|part_payment)$/.test(s)) return "part";
  if (/^(unpaid|not_paid|owing|on_credit|credit)$/.test(s)) return "credit";
  if (s === "refunded") return "refund";
  if (/^partially_refunded$/.test(s)) return "partRefund";
  return "skip";
}
const CEDIS = /gh[₵¢]|ghs|cedi/i;
const num = (v: string) => { const s = v.trim().replace(/[,\s]/g, ""); if (!s) return undefined; const n = Number(s); return Number.isFinite(n) ? n : NaN; };
const isEmail = (v: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v);
export const categoryFrom = (v: string): string => {
  const s = v.trim().toLowerCase();
  if (!s) return "other";
  const hit = DEFAULT_CATEGORIES.find((c) => c.id === s || c.label.toLowerCase() === s || c.label.toLowerCase().startsWith(s) || s.includes(c.id));
  return hit ? hit.id : cleanText(s, 40).replace(/[^a-z0-9 _-]/g, "").trim() || "other";
};
// Money that may be signed: "-5,000.00", "(5,000)", "5,000.00 DR", "₦5,000 CR". Kobo, negative for money out; undefined when empty.
export function signedKobo(v: string): number | null | undefined {
  let s = v.trim();
  if (!s || s === "-" || s === "—") return undefined;
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1).trim(); }
  const dc = s.match(/\s*\b(dr|cr)\.?$/i);
  if (dc) { neg = dc[1].toLowerCase() === "dr"; s = s.slice(0, dc.index).trim(); }
  if (s.startsWith("-") || s.startsWith("−")) { neg = true; s = s.slice(1); } else if (s.startsWith("+")) s = s.slice(1);
  const k = toKobo(s);
  return k === null ? null : neg ? -k : k;
}

// Bank lines: a simple rules-based guess at what each one is, from its narration (Nana isn't used here: it would be charged to the
// seller's allowance for every line). The seller ticks and changes each line in the preview.
type Guess = { as: "sale" | "expense" | "skip"; category: string; tick: boolean; why: string };
const SPEND: { re: RegExp; category: string; why: string }[] = [
  { re: /sms (alert|charge)|stamp duty|\bvat\b|maint(enance)? (fee|charge)|account maintenance|\bcot\b|\bemtl\b|bank charge|transfer (fee|charge)|nip charge|\bcharges?\b|\bcomm(ission)?\b/i, category: "bank", why: "bank charges" },
  { re: /airtime|\bdata\b|recharge|\bvtu\b|\bmtn\b|\bglo\b|airtel|9mobile/i, category: "data", why: "airtime or data" },
  { re: /nepa|phcn|ekedc|ikedc|aedc|eedc|phed|kedco|ibedc|bedc|\bjed\b|electric|prepaid meter|\bdiesel\b|generator/i, category: "power", why: "electricity or diesel" },
  { re: /\bfuel\b|petrol|\bpms\b|filling station|\bnnpc\b|\buber\b|\bbolt\b|gig logistics|dispatch|transport|logistics|keke|okada/i, category: "transport", why: "fuel or transport" },
  { re: /\brent\b|landlord/i, category: "rent", why: "rent" },
  { re: /salary|salaries|wages|staff pay/i, category: "staff", why: "staff pay" },
  { re: /\blev(y|ies)\b|\blga?\b|market (ass|dues)|association dues|union dues/i, category: "levies", why: "levies or dues" },
  { re: /repair|mechanic|servicing|vulcani/i, category: "repairs", why: "repairs" },
];
export function guessBankLine(narration: string, moneyIn: boolean): Guess {
  const s = narration.toLowerCase();
  if (moneyIn) {
    if (/revers|refund|\bloan\b|own account|\bself\b|interest|savings|owealth|cashback|bonus|from my |\brvsl\b/.test(s)) return { as: "skip", category: "", tick: false, why: "looks like a reversal, loan, interest or your own money" };
    if (/\bpos\b|\btrf\b|transfer|\bnip\b|\bfrm\b|from |inflow|deposit|lodg|settlement|ussd|\bpayment\b|\bcr\b/.test(s)) return { as: "sale", category: "", tick: true, why: "money from a customer?" };
    return { as: "sale", category: "", tick: false, why: "money in: is it a sale?" };
  }
  for (const r of SPEND) if (r.re.test(s)) return { as: "expense", category: r.category, tick: true, why: r.why };
  if (/\bpos\b|web purchase|card purchase|\bpurchase\b/.test(s)) return { as: "expense", category: "other", tick: false, why: "a card or POS payment: what for?" };
  return { as: "expense", category: "other", tick: false, why: "money out: you choose" };
}

export type StockRow = { row: number; name: string; sku: string; category: string; priceKobo?: number; costKobo?: number; stock?: number; unit: string; lowAt?: number };
export type SaleLine = { title: string; qty: number; unitKobo: number };
export type SaleRow = {
  row: number; on: string; at: string; title: string; qty: number; unitKobo: number; totalKobo: number; paidKobo: number; method: Method; customer: string; phone: string; dueOn?: string; note: string;
  lines?: SaleLine[]; ref?: string; email?: string; refundKobo?: number; feeKobo?: number;
};
export type ExpenseRow = { row: number; on: string; amountKobo: number; category: string; description: string; method: Method };
export type CustomerRow = { row: number; name: string; phone: string; owesKobo: number; dueOn?: string; note: string; email?: string };
export type BankRow = { row: number; on: string; at: string; narration: string; ref: string; inKobo: number; outKobo: number; as: Guess["as"]; category: string; tick: boolean; why: string };
export type RowOf<K extends ImportKind> = K extends "stock" ? StockRow : K extends "sales" ? SaleRow : K extends "expenses" ? ExpenseRow : K extends "bank" ? BankRow : CustomerRow;
export type Problem = { row: number; message: string };

// Every row into a clean record, a problem the seller sees in the preview (nothing is saved until they choose Import), or a row left out
// on purpose (a pending order, one of our own payments) with the reason. Notes are things we changed and the seller should know.
export function readRows<K extends ImportKind>(sheet: Sheet, mapping: Mapping, kind: K, today: string, preset?: Preset): { rows: RowOf<K>[]; problems: Problem[]; skipped: Problem[]; notes: Problem[] } {
  const rules = (preset && preset.kind === kind ? preset.rules : undefined) ?? {};
  const rows: RowOf<K>[] = [], problems: Problem[] = [], skipped: Problem[] = [], notes: Problem[] = [];
  const at = (r: string[], f: string) => { const i = mapping.indexOf(f); return i >= 0 ? String(r[i] ?? "").trim() : ""; };
  const cedis = (r: string[]) => r.some((x, i) => mapping[i] && CEDIS.test(x));
  const CEDI_MSG = "Prices in cedis wait for cedi support (the Ghana launch). Use naira for now.";
  // An amount in naira, or a problem on that row (null). Undefined when empty and not needed.
  const kobo = (row: number, v: string, label: string, needed = false): number | undefined | null => {
    if (!v) { if (needed) { problems.push({ row, message: `${label} is empty.` }); return null; } return undefined; }
    const k = toKobo(v);
    if (k === null) { problems.push({ row, message: `${label} “${v.slice(0, 30)}” isn't an amount in naira.` }); return null; }
    return k;
  };
  const isoAt = (on: string, hm?: string) => new Date(Date.parse(`${on}T${hm ?? "12:00"}:00+01:00`)).toISOString();
  const hmOf = (time: string, when: { hm?: string }) => { const t = time.match(/^(\d{1,2}):(\d{2})/); return t ? `${t[1].padStart(2, "0")}:${t[2]}` : when.hm; };

  if (kind === "sales") {
    // Rows with the same order number are one sale (Shopify and the Woo plugins put each extra item on its own row).
    const groups = new Map<string, { row: number; r: string[] }[]>();
    const refCol = mapping.indexOf("ref");
    sheet.rows.forEach((r, n) => {
      if (!r.some((x) => x.trim())) return;
      const ref = refCol >= 0 ? String(r[refCol] ?? "").trim() : "";
      const key = ref ? `r:${ref}` : `n:${n}`;
      const g = groups.get(key);
      if (g) g.push({ row: n + 2, r }); else groups.set(key, [{ row: n + 2, r }]);
    });
    for (const g of groups.values()) {
      const row = g[0].row;
      const bad = (message: string) => { problems.push({ row, message }); };
      const get = (f: string) => { for (const x of g) { const v = at(x.r, f); if (v) return v; } return ""; };
      if (g.some((x) => cedis(x.r))) { bad(CEDI_MSG); continue; }
      const ref = cleanText(get("ref"), 60);
      const name = ref ? (/^#/.test(ref) ? `Order ${ref}` : ref) : "This row";
      if (rules.ourRefs && ref && OUR_REF_PREFIXES.some((p) => ref.startsWith(p))) { skipped.push({ row, message: `${ref} is a #NotesApp order: it's already in your books.` }); continue; }
      const statusRaw = get("status");
      const st = saleStatus(statusRaw, rules.statuses === "paystack");
      if (st === "skip") { skipped.push({ row, message: `${name} is “${statusRaw.slice(0, 30)}”, not paid, so it's left out.` }); continue; }
      const cur = get("currency").toUpperCase().replace(/[^A-Z₦]/g, "");
      if (cur && !["NGN", "₦", "NAIRA"].includes(cur)) { bad(`${name} is in ${cur}. Books keeps naira only, so it can't come in: export your naira sales only, or take out the ${cur} rows.`); continue; }
      const when = parseWhen(get("date"));
      if (!when) { bad(`The date “${get("date").slice(0, 20)}” isn't one we can read (try 2026-10-12 or 12/10/2026).`); continue; }
      if (when.on > today) { bad("The date is in the future."); continue; }
      // The lines: each row's item, quantity and price (or line total).
      const lines: SaleLine[] = [];
      let broken = false;
      for (const x of g) {
        const title = cleanText(at(x.r, "item"), 120);
        if (!title) continue;
        const q = num(at(x.r, "qty"));
        const qty = q === undefined ? 1 : q;
        if (!Number.isInteger(qty) || qty < 1 || qty > 100_000) { problems.push({ row: x.row, message: "The quantity should be a whole number, 1 or more." }); broken = true; break; }
        const unit = kobo(x.row, at(x.r, "unitPrice"), "Price each"), lt = kobo(x.row, at(x.r, "lineTotal"), "Line total");
        if (unit === null || lt === null) { broken = true; break; }
        lines.push({ title, qty, unitKobo: unit ?? (lt !== undefined ? Math.round(lt / qty) : -1) });
      }
      if (broken) continue;
      const total = kobo(row, get("total"), "Total");
      if (total === null) continue;
      if (!lines.length) {
        if (!ref) { bad("The row has no item or description."); continue; }
        lines.push({ title: cleanText(`${rules.title ?? "Sale"} ${ref}`, 120), qty: 1, unitKobo: total ?? -1 });
      }
      if (lines.length === 1 && lines[0].unitKobo < 0 && total !== undefined) lines[0].unitKobo = Math.round(total / lines[0].qty);
      if (lines.some((l) => l.unitKobo < 0)) { bad(total === undefined && lines.length === 1 ? "The row needs a total or a price each." : "An item has no price: add a price each or a line total."); continue; }
      const totalKobo = total ?? lines.reduce((n, l) => n + l.qty * l.unitKobo, 0);
      const paid = kobo(row, get("paid"), "Amount paid"), due = kobo(row, get("due"), "Still to pay");
      if (paid === null || due === null) continue;
      const methodRaw = get("method"), m = parseMethod(methodRaw);
      const paidKobo = st === "credit" ? Math.min(paid ?? 0, totalKobo)
        : due !== undefined ? Math.max(0, totalKobo - due)
        : paid !== undefined ? Math.min(paid, totalKobo)
        : m === "credit" ? 0 : totalKobo;
      // Online shops and Paystack: a card payment is a card, not a POS terminal; anything we don't know is paid online (card).
      const method: Method = rules.online ? (m === "transfer" || m === "cash" ? m : m === "pos" && /\bpos\b/i.test(methodRaw) ? "pos" : "card") : m && m !== "credit" ? m : "cash";
      const emailRaw = get("email").toLowerCase();
      const email = isEmail(emailRaw) ? emailRaw.slice(0, 120) : "";
      const customer = cleanText([get("customer"), get("lastName")].filter(Boolean).join(" "), 80) || email;
      if (paidKobo < totalKobo && !customer) { bad("A sale on credit needs the customer's name."); continue; }
      const dueRaw = get("dueOn"), dueOn = dueRaw ? parseDay(dueRaw) : undefined;
      if (dueRaw && !dueOn) { bad("The due date isn't one we can read."); continue; }
      const refunded = kobo(row, get("refunded"), "Refunded");
      if (refunded === null) continue;
      let refundKobo = st === "refund" ? refunded || totalKobo : refunded ?? 0;
      refundKobo = Math.min(refundKobo, totalKobo);
      if (st === "partRefund" && !refundKobo) notes.push({ row, message: `${name} was partly refunded, but the file doesn't say how much, so only the sale comes in.` });
      const fee = kobo(row, get("fee"), "Fees");
      if (fee === null) continue;
      const phone = waPhone(get("phone")) ?? "";
      const first = lines[0];
      rows.push({
        row, on: when.on, at: isoAt(when.on, hmOf(get("time"), when)), title: first.title, qty: first.qty, unitKobo: first.unitKobo, totalKobo, paidKobo, method, customer, phone, ...(dueOn ? { dueOn } : {}), note: cleanText(get("note"), 200),
        ...(lines.length > 1 ? { lines } : {}), ...(ref ? { ref } : {}), ...(email ? { email } : {}), ...(refundKobo ? { refundKobo } : {}), ...(fee ? { feeKobo: fee } : {}),
      } as RowOf<K>);
    }
    return { rows, problems, skipped, notes };
  }

  // Stock lists: a product's options under the same handle or parent take the product's name, each option its own item.
  const groupName = new Map<string, string>();
  sheet.rows.forEach((r, n) => {
    const row = n + 2; // the heading is row 1
    if (!r.some((x) => x.trim())) return;
    const bad = (message: string) => { problems.push({ row, message }); };
    if (cedis(r)) return bad(CEDI_MSG);
    const money = (f: string, label: string, needed = false) => kobo(row, at(r, f), label, needed);
    if (kind === "stock") {
      const type = at(r, "type").toLowerCase();
      const group = at(r, "group").replace(/^id:/i, ""), ext = at(r, "extId");
      let name = cleanText(at(r, "name"), 120);
      // The first name under a handle or parent is the product's (a Woo variation's own name never replaces its parent's).
      if (name) for (const k of [group, ext, at(r, "sku")]) if (k && !groupName.has(k)) groupName.set(k, name);
      if (/^(variable|grouped|external)\b/.test(type)) { skipped.push({ row, message: `${name || "This product"} has options (or is a group), so it's left out and each option comes in as an item.` }); return; }
      const opts = [at(r, "variant"), at(r, "variant2"), at(r, "variant3")].filter((v) => v && !/^default title$/i.test(v));
      if (!name && group) {
        // An extra row of a product: an option, or only an image (Shopify), which is skipped.
        if (!opts.length && !at(r, "sku") && !at(r, "price") && !at(r, "stock")) return;
        name = groupName.get(group) ?? "";
      }
      if (!name) return bad("The item has no name.");
      if (opts.length && !opts.every((o) => name.toLowerCase().includes(o.toLowerCase()))) name = cleanText(`${name} (${opts.join(" / ")})`, 120);
      const price = money("price", "Price"), cost = money("cost", "Cost price");
      if (price === null || cost === null) return;
      let st = num(at(r, "stock"));
      const low = num(at(r, "lowAt"));
      if (st !== undefined && rules.clampStock && Number.isInteger(st) && st < 0) { notes.push({ row, message: `${name}: stock was ${st} in the file, so it comes in as 0.` }); st = 0; }
      if (st !== undefined && (!Number.isInteger(st) || st < 0 || st > 1_000_000)) return bad(`Stock is ${at(r, "stock")}. Stock is a whole number, 0 or more.`);
      if (low !== undefined && (!Number.isInteger(low) || low < 0)) return bad("The low-stock level should be a whole number.");
      rows.push({ row, name, sku: at(r, "sku").toUpperCase().replace(/[^A-Z0-9._\-/]/g, "-").slice(0, 40), category: cleanText(at(r, "category").split(/[>,|]/)[0], 40), ...(price !== undefined ? { priceKobo: price } : {}), ...(cost !== undefined ? { costKobo: cost } : {}), ...(st !== undefined ? { stock: st } : {}), unit: cleanText(at(r, "unit"), 20), ...(low !== undefined ? { lowAt: low } : {}) } as RowOf<K>);
    } else if (kind === "expenses") {
      const on = parseDay(at(r, "date"));
      if (!on) return bad(`The date “${at(r, "date").slice(0, 20)}” isn't one we can read (try 2026-10-12 or 12/10/2026).`);
      if (on > today) return bad("The date is in the future.");
      const amount = money("amount", "Amount", true);
      if (amount === null || amount === undefined) return;
      if (amount === 0) return bad("The amount is 0.");
      const m = parseMethod(at(r, "method"));
      rows.push({ row, on, amountKobo: amount, category: categoryFrom(at(r, "category")), description: cleanText(at(r, "description"), 200), method: m && m !== "credit" ? m : "cash" } as RowOf<K>);
    } else if (kind === "bank") {
      const when = parseWhen(at(r, "date"));
      if (!when) {
        // Statements end with totals and opening or closing balance lines: those are left out, not problems.
        if (/total|balance|opening|closing|brought|carried/i.test(r.join(" "))) return;
        return bad(`The date “${at(r, "date").slice(0, 20)}” isn't one we can read (try 2026-10-12 or 12/10/2026).`);
      }
      if (when.on > today) return bad("The date is in the future.");
      const narration = cleanText(at(r, "narration"), 160);
      if (/^(opening|closing) balance|^balance (b\/f|brought|c\/f|carried)/i.test(narration)) return;
      const cr = signedKobo(at(r, "credit")), dr = signedKobo(at(r, "debit")), amt = signedKobo(at(r, "amount"));
      if (cr === null || dr === null || amt === null) return bad(`The amount “${(at(r, "credit") || at(r, "debit") || at(r, "amount")).slice(0, 30)}” isn't an amount in naira.`);
      let inKobo = Math.abs(cr ?? 0), outKobo = Math.abs(dr ?? 0);
      if (!inKobo && !outKobo && amt) {
        const dc = at(r, "drcr").toLowerCase();
        const out = dc ? /^d|debit|withdraw|out/.test(dc) : amt < 0;
        if (out) outKobo = Math.abs(amt); else inKobo = Math.abs(amt);
      }
      if (!inKobo && !outKobo) return; // a line with no money (a note on the statement)
      if (inKobo && outKobo) return bad("The line has money in and money out: one at a time, please.");
      const g = guessBankLine(narration, inKobo > 0);
      rows.push({ row, on: when.on, at: isoAt(when.on, when.hm), narration: narration || (inKobo ? "Money in" : "Money out"), ref: cleanText(at(r, "ref"), 60), inKobo, outKobo, ...g } as RowOf<K>);
    } else {
      const emailRaw = at(r, "email").toLowerCase();
      const email = isEmail(emailRaw) ? emailRaw.slice(0, 120) : "";
      const name = cleanText(at(r, "name"), 80) || email;
      if (!name) return bad("The customer has no name.");
      const owes = money("owes", "Owes you");
      if (owes === null) return;
      const dueRaw = at(r, "dueOn"), dueOn = dueRaw ? parseDay(dueRaw) : undefined;
      if (dueRaw && !dueOn) return bad("The due date isn't one we can read.");
      const rawPhone = at(r, "phone");
      const phone = rawPhone ? waPhone(rawPhone) : "";
      if (rawPhone && !phone) return bad(`The phone number “${rawPhone.slice(0, 20)}” doesn't look right.`);
      rows.push({ row, name, phone: phone ?? "", owesKobo: owes ?? 0, ...(dueOn ? { dueOn } : {}), note: cleanText(at(r, "note"), 200), ...(email ? { email } : {}) } as RowOf<K>);
    }
  });
  return { rows, problems, skipped, notes };
}

// ---- A bank statement PDF (text, not a scan) ----
// The browser reads the PDF's text lines (pdfjs-dist, as components/PdfViewer.tsx does); this turns them into the bank CSV. A line that
// starts with a date and ends with two amounts is a transaction: the last amount is the balance, the one before it what moved, and
// which way it moved comes from the balance going up or down (or a CR/DR mark). Lines that don't fit are left out. Null when nothing fits,
// so the wizard asks for a CSV from the bank app instead.
export function statementFromPdfLines(lines: string[]): string | null {
  const AMT = /(?:-|\()?₦?\s?\d{1,3}(?:,\d{3})*(?:\.\d{2})\)?(?:\s?(?:CR|DR))?/gi;
  const out: (string | number)[][] = [["date", "narration", "debit", "credit", "balance"]];
  let prev: number | null = null;
  for (const raw of lines) {
    const line = raw.replace(/\s+/g, " ").trim();
    const dm = line.match(/^(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|\d{4}-\d{2}-\d{2}|\d{1,2}[ -][A-Za-z]{3,9}[ -]\d{2,4})\b/);
    if (!dm || !parseDay(dm[1])) {
      const ob = line.match(/opening balance.*?([\d,]+\.\d{2})/i);
      if (ob && prev === null) prev = toKobo(ob[1]);
      continue;
    }
    const amts = [...line.matchAll(AMT)].map((m) => ({ text: m[0], at: m.index ?? 0 })).filter((a) => a.at > dm[1].length);
    if (amts.length < 2) continue;
    const bal = signedKobo(amts[amts.length - 1].text.replace(/[()]/g, "")), mv = signedKobo(amts[amts.length - 2].text.replace(/[()]/g, ""));
    if (bal == null || mv == null || mv === 0) continue;
    let rest = line.slice(dm[1].length, amts[amts.length - 2].at);
    // A value date after the transaction date is not part of the narration.
    rest = rest.replace(/^\s*(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|\d{4}-\d{2}-\d{2}|\d{1,2}[ -][A-Za-z]{3,9}[ -]\d{2,4})\s*/, "").trim();
    let dir: "in" | "out" | null = /cr$/i.test(amts[amts.length - 2].text) ? "in" : /dr$/i.test(amts[amts.length - 2].text) || mv < 0 ? "out" : null;
    if (!dir && prev !== null) dir = bal > prev ? "in" : "out";
    prev = bal;
    if (!dir) continue;
    const k = Math.abs(mv) / 100;
    out.push([dm[1], rest || "(no narration)", dir === "out" ? k.toFixed(2) : "", dir === "in" ? k.toFixed(2) : "", (bal / 100).toFixed(2)]);
  }
  return out.length > 1 ? csvOf(out) : null;
}

// ---- Duplicates (docs/BUSINESS-BOOKS.md: by the source's own order number or reference first; then items by SKU then exact name;
// sales and expenses by date + amount + item or description; customers by phone, email, then exact name). A row that matches what's
// already in the books, or an earlier row in the same file, is skipped.
const low = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
export const saleKey = (on: string, totalKobo: number, title: string) => `${on}|${totalKobo}|${low(title)}`;
export const expenseKey = (on: string, amountKobo: number, text: string) => `${on}|${amountKobo}|${low(text)}`;
export const refKey = (source: string, ref: string) => `ref:${source}:${low(ref)}`;
export const itemKeys = (sku: string, name: string) => ({ sku: sku ? sku.toUpperCase() : "", name: low(name) });
export const customerKey = (phone: string, name: string, email = "") => (phone ? `p:${phone}` : email ? `e:${low(email)}` : `n:${low(name)}`);
// Splits rows into new ones and duplicates, given the keys already in the books.
export function dedupe<T>(rows: T[], keyOf: (r: T) => string | string[], existing: Set<string>): { fresh: T[]; dupes: T[] } {
  const seen = new Set(existing), fresh: T[] = [], dupes: T[] = [];
  for (const r of rows) {
    const keys = ([] as string[]).concat(keyOf(r)).filter(Boolean);
    if (keys.some((k) => seen.has(k))) dupes.push(r);
    else { fresh.push(r); keys.forEach((k) => seen.add(k)); }
  }
  return { fresh, dupes };
}

// ---- Templates to download ----
export const TEMPLATES: Record<ImportKind, string[][]> = {
  stock: [["name", "sku", "category", "price_naira", "cost_naira", "stock", "unit", "low_stock_at"], ["Rice 10kg (Mama Gold)", "RICE-MG-10", "Foodstuff", "15000", "12800", "18", "bag", "3"]],
  sales: [["date", "time", "item", "quantity", "unit_price", "total", "amount_paid", "payment_method", "customer_name", "customer_phone", "due_date", "notes"], ["2026-10-12", "14:05", "Rice 10kg (Mama Gold)", "3", "15000", "45000", "20000", "cash", "Bisi Adebayo", "08031234567", "2026-10-26", ""]],
  expenses: [["date", "amount", "category", "description", "payment_method"], ["2026-10-12", "18000", "Power (diesel and NEPA)", "Diesel for the generator", "cash"]],
  customers: [["name", "phone", "owes", "due_date", "note"], ["Chinedu Okafor", "08031234567", "38500", "2026-10-27", "Ankara and garri"]],
  bank: [["date", "narration", "reference", "debit", "credit", "balance"], ["2026-10-12", "TRF FROM BISI ADEBAYO", "FT26101200041", "", "45000", "152000"]],
};
const cell = (v: string | number) => { let s = String(v); if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export const csvOf = (rows: (string | number)[][]) => rows.map((r) => r.map(cell).join(",")).join("\n") + "\n";
export const templateCsv = (kind: ImportKind) => csvOf(TEMPLATES[kind]);
