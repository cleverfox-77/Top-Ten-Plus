import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'

let db: Database.Database | null = null

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('admin','sales_manager')),
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS customers (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  phone      TEXT NOT NULL UNIQUE,
  address    TEXT,
  notes      TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS fabrics (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id           TEXT NOT NULL UNIQUE,
  name                 TEXT NOT NULL,
  color                TEXT,
  unit                 TEXT NOT NULL DEFAULT 'gaz',
  quantity_base        REAL NOT NULL DEFAULT 0,   -- centimeters
  cost_price_per_unit  REAL,
  low_stock_threshold  REAL NOT NULL DEFAULT 0,   -- centimeters
  created_at           TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS orders (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id            INTEGER NOT NULL REFERENCES customers(id),
  order_date             TEXT NOT NULL DEFAULT (date('now','localtime')),
  expected_delivery_date TEXT,
  status                 TEXT NOT NULL DEFAULT 'received',
  payment_method         TEXT NOT NULL DEFAULT 'cash',
  total_price            REAL NOT NULL DEFAULT 0,
  amount_paid            REAL NOT NULL DEFAULT 0,
  due_amount             REAL NOT NULL DEFAULT 0,
  due_date               TEXT,
  created_by             INTEGER NOT NULL REFERENCES users(id),
  created_at             TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS order_items (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id              INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  garment_type          TEXT NOT NULL,
  measurements          TEXT NOT NULL DEFAULT '{}',  -- JSON
  style_options         TEXT NOT NULL DEFAULT '{}',  -- JSON
  fabric_id             INTEGER REFERENCES fabrics(id),
  fabric_quantity_used  REAL,                        -- in fabric_unit
  fabric_unit           TEXT,
  price                 REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  fabric_id          INTEGER NOT NULL REFERENCES fabrics(id),
  change_amount      REAL NOT NULL,   -- centimeters; negative = deduction
  reason             TEXT NOT NULL CHECK (reason IN ('new_stock','order_deduction','correction')),
  reference_order_id INTEGER REFERENCES orders(id),
  created_by         INTEGER NOT NULL REFERENCES users(id),
  created_at         TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS sms_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  order_id    INTEGER REFERENCES orders(id),
  message     TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('order_confirmation','ready_notice')),
  status      TEXT NOT NULL,
  sent_at     TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(order_date);
CREATE INDEX IF NOT EXISTS idx_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_movements_fabric ON stock_movements(fabric_id);
`

export function getDb(): Database.Database {
  if (db) return db

  const dir = join(app.getPath('userData'), 'data')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  const file = join(dir, 'topten.db')

  db = new Database(file)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.exec(SCHEMA)
  return db
}

/** For diagnostics / "where is my data" support. */
export function getDbPath(): string {
  return join(app.getPath('userData'), 'data', 'topten.db')
}
