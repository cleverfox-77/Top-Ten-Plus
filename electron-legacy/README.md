# Top Ten Plus — Tailoring POS & Inventory (Desktop)

A Windows desktop application for a bespoke tailoring shop: order intake with a
per-garment measurement/style configurator, fabric inventory with automatic
stock deduction, printable order slips, sales history, SMS notifications, and an
analytics dashboard.

Built from the *Top Ten Plus Implementation Plan*. The plan targeted a web app on
Vercel + Neon Postgres; this is the **desktop adaptation** — it runs entirely on
the shop's PC with a **local SQLite database**, so it works offline with no
hosting costs and all data stays on-site.

---

## Tech stack

| Layer | Choice |
|---|---|
| Desktop shell | Electron 33 |
| UI | React 18 + TypeScript + React Router (hash) |
| Styling | Tailwind CSS (red/white branding) |
| Build | electron-vite (Vite 5) |
| Database | SQLite via `better-sqlite3` (local file) |
| Validation | Zod |
| Auth | Local accounts, `bcryptjs` password hashing |

Data lives in a single SQLite file under your Windows user profile:
`%APPDATA%\Top Ten Plus\data\topten.db` (packaged build) or
`%APPDATA%\Electron\data\topten.db` (when run in dev/preview).

---

## Getting started

```bash
npm install        # installs deps and rebuilds better-sqlite3 for Electron
npm run dev        # launch the app with hot-reload
```

### Default logins (change these after first run, under **Staff**)

| Role | Username | Password |
|---|---|---|
| Admin | `admin` | `admin123` |
| Sales Manager | `sales` | `sales123` |

The database and these two accounts (plus a few sample fabrics) are created
automatically on first launch.

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Run the app in development with HMR |
| `npm run build` | Type-agnostic production bundle into `out/` |
| `npm start` | Preview the production bundle |
| `npm run dist` | Build a Windows installer (`.exe`) into `release/` via electron-builder |
| `npm run rebuild` | Rebuild `better-sqlite3` against Electron's ABI (run if the native module errors) |

### Building the installer

```bash
npm run dist
```

Produces `release/Top Ten Plus-Setup-1.0.0.exe` — a standard Windows installer
that creates a desktop shortcut. Distribute this to the shop PC.

---

## Features (mapped to the implementation plan)

- **Roles & permissions (§2)** — Admin vs Sales Manager. Sales Manager can take
  orders and view stock read-only; only Admin edits stock, manages staff, and
  sees full revenue analytics.
- **Order configurator (§3)** — one order → one customer → many garment line
  items. Coat, Pant, Shirt, Panjabi, each with its own measurement set and style
  options. Single-breasted coats reveal the Bottom shape / Button style / Side
  vent groups. Measurements & style choices are stored as JSON per item.
- **Customers (§4)** — looked up by phone; "Use last measurements" prefills a
  repeat customer's previous measurements for that garment type.
- **Payment & status (§5)** — payment method, advance/due tracking (auto-computed
  due), and a Received → In stitching → Ready for pickup → Delivered workflow.
- **Fabric & stock (§6, §7)** — fabric selected per garment with a quantity in
  any unit (inch/feet/cm/meter/Gaz); stock is stored internally in centimeters
  and deducted automatically on order confirmation. Overselling is blocked.
- **Printing (§8)** — a printable order slip / tailor job card (browser print).
- **SMS (§9)** — automatic confirmation logged on order creation, and a manual
  "ready for pickup" notice. **Gateway is stubbed** — messages are composed and
  logged but not delivered. See "Going live with SMS" below.
- **Sales history (§10)** — filterable table with CSV export (Excel-friendly,
  BOM-encoded for Bangla).
- **Analytics (§11)** — fabric sold in BDT, stock remaining, low-stock alerts,
  revenue trend, best-selling garments, top customers, staff performance.
- **Audit trail (§12)** — every stock change is recorded in `stock_movements`.
- **Bilingual labels (§13)** — a central dictionary shows `English (বাংলা)` for
  common terms; trade jargon (FD/CB, Mohuri, Lob round…) is left in English until
  shop staff confirm the exact wording.

---

## Going live with SMS

SMS is intentionally stubbed for v1. To send real messages:

1. Open `src/main/services/sms.ts`.
2. Implement the `dispatch()` function against your chosen Bangladesh gateway's
   REST API (BulkSMSBD, MiMSMS, Alpha SMS, or sms.bd).
3. Set `GATEWAY_ENABLED = true`.

Everything else (composing messages, the notify workflow, the SMS log) already
works — only the network call needs wiring.

---

## Decisions taken on the plan's open questions (§16)

These follow the plan's own recommendations and are easy to change:

1. **Panjabi measurements** reuse the Shirt set.
2. **Sales Manager analytics** — Sales Managers see their own order activity and
   sales history; full revenue analytics is Admin-only.
3. **SMS gateway** — stubbed; pick a provider and wire `dispatch()`.
4. **Single-breasted options** — grouped into Bottom shape / Button style / Side vent.
5. **Fabric tracking** — recorded per garment item.

---

## Project layout

```
src/
  shared/      types, bilingual labels, unit conversion, garment definitions, Zod schemas
  main/        Electron main process
    db/        SQLite connection, schema, seed
    services/  auth, customers, fabrics, orders, sms, users, analytics
    ipc.ts     typed IPC handlers (with role guards)
    index.ts   app entry
  preload/     contextBridge API
  renderer/    React UI (pages/, components/, lib/)
```

## Verifying the build

A headless end-to-end self-test of the service layer is included:

```bash
npm run build
SMOKE_TEST=1 npx electron out/main/index.js   # (PowerShell: $env:SMOKE_TEST=1; npx electron out/main/index.js)
```

It logs in, creates a customer and order, and asserts stock deduction, due
computation, JSON persistence, auto-SMS logging, and oversell protection.
