# Top Ten Plus — Tailoring POS & Inventory (Web App)

An online order-intake, fabric-inventory, and sales system for the Top Ten Plus
bespoke tailoring shop. Built exactly to the implementation plan: **Next.js on
Vercel + Neon Postgres**.

## Tech stack

| Layer | Choice |
|---|---|
| Frontend + backend | Next.js 14 (App Router), TypeScript, **Server Actions** (no separate API layer) |
| Styling | Tailwind CSS (red/white branding) |
| Database | **Neon Postgres** (serverless) |
| ORM | **Drizzle ORM** + Neon serverless driver |
| Auth | Signed cookie session, `bcryptjs` hashing — 2 fixed roles, no self-signup |
| Hosting | **Vercel** |

## Local setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create your env file and add a Neon connection string:
   ```bash
   cp .env.example .env.local
   # edit .env.local: set DATABASE_URL and SESSION_SECRET
   ```
   Get a free `DATABASE_URL` from https://neon.tech (or the Vercel → Neon
   integration). Generate a `SESSION_SECRET`:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
3. Create the tables and seed default data:
   ```bash
   npm run db:push     # or: npm run db:migrate  (applies ./drizzle SQL)
   npm run db:seed
   ```
4. Run it:
   ```bash
   npm run dev         # http://localhost:3000
   ```

### Default logins (change under **Staff** after first login)

| Role | Username | Password |
|---|---|---|
| Admin | `admin` | `admin123` |
| Sales Manager | `sales` | `sales123` |

## Deploying to Vercel

1. Push this project to a Git repo and **Import** it in Vercel.
2. Add the same env vars in Vercel → Project → Settings → Environment Variables:
   - `DATABASE_URL` — your Neon connection string
   - `SESSION_SECRET` — a long random string
   (The Vercel → Neon integration can set `DATABASE_URL` for you automatically.)
3. Deploy. On the first deploy, run migrations against the production DB once:
   ```bash
   npm run db:migrate   # or db:push, with production DATABASE_URL in your shell
   npm run db:seed
   ```
   You can also run these from your machine with the production `DATABASE_URL`
   exported, or add a one-off Vercel build/CLI step.

Every git branch/PR can get its own isolated Neon database branch — handy for
testing without touching real shop data.

## Features (mapped to the implementation plan)

- **§2 Roles** — Admin vs Sales Manager, enforced inside every server action.
- **§3 Order configurator** — one order → one customer → many garment items
  (Coat, Pant, Shirt, Panjabi), each with its own measurements + style options.
  Single-breasted coats reveal Bottom shape / Button style / Side vent. Stored as
  JSONB per item so new fields are a code change, not a migration.
- **§4 Customers** — phone lookup; "Use last measurements" prefills repeat orders.
- **§5 Payment & status** — advance/due tracking (auto-computed) and the
  Received → In stitching → Ready → Delivered workflow.
- **§6–7 Fabric & stock** — multi-unit entry (inch/feet/cm/meter/Gaz), stored in
  centimeters, deducted automatically on order confirmation (a real Postgres
  transaction; overselling is blocked). Admin-only writes.
- **§8 Printing** — printable order slip / tailor job card (browser print).
- **§9 SMS** — auto confirmation + manual "ready" notice. **Gateway stubbed**;
  wire `dispatch()` in `src/lib/sms-util.ts` and set `GATEWAY_ENABLED = true`.
- **§10 Sales history** — filterable table + CSV export (Excel/Bangla-safe).
- **§11 Analytics** — fabric sold in BDT, stock levels, low-stock alerts, revenue
  trend, best-sellers, top customers, staff performance.
- **§12 Audit trail** — every stock change recorded in `stock_movements`.
- **§13 Bilingual labels** — central dictionary shows `English (বাংলা)`; trade
  jargon left in English until staff confirm wording.

## Project layout

```
src/
  db/            Drizzle schema, Neon client, seed script
  lib/           types, labels, units, garments, validation, session, api wrapper
  actions/       server actions (auth, customers, fabrics, orders, sms, users, analytics)
  components/    shared UI (AppShell, Sidebar, Login, modals, primitives)
  app/           App Router pages (dashboard, orders, customers, stock, sales, notify, analytics, staff)
drizzle/         generated SQL migrations
electron-legacy/ the earlier desktop build, kept for reference (not part of this app)
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server (http://localhost:3000) |
| `npm run build` / `npm start` | Production build / serve |
| `npm run db:generate` | Generate SQL migrations from the schema |
| `npm run db:push` | Push the schema straight to the database |
| `npm run db:migrate` | Apply the generated migrations |
| `npm run db:seed` | Seed default users + sample fabrics |

## Decisions on the plan's open questions (§16)

1. Panjabi measurements reuse the Shirt set.
2. Sales Managers see their own activity + sales history; full revenue analytics
   is Admin-only.
3. SMS gateway stubbed — pick a provider and wire `dispatch()`.
4. Single-breasted options grouped into Bottom shape / Button style / Side vent.
5. Fabric usage tracked per garment item.
