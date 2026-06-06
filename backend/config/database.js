/**
 * database.js
 *
 * Initialises a sql.js SQLite database, applies WAL-equivalent settings,
 * creates the schema with triggers, and exposes a safe ticket_id generator.
 *
 * sql.js is a pure-JS WebAssembly port of SQLite — identical SQL syntax,
 * no native build required. The DB is held in memory and flushed to disk
 * after every mutating operation so durability matches a file-based driver.
 */

'use strict';

const initSqlJs = require('sql.js');
const fs        = require('fs');
const path      = require('path');

const DB_PATH = path.join(__dirname, '../db/crm.db');

/** @type {import('sql.js').Database | null} */
let db = null;

/* ─────────────────────────────────────────────────────────────
   SCHEMA
   ───────────────────────────────────────────────────────────── */
const SCHEMA = `
  /* ── tickets ─────────────────────────────────────────────── */
  CREATE TABLE IF NOT EXISTS tickets (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id      TEXT    NOT NULL UNIQUE,
    customer_name  TEXT    NOT NULL,
    customer_email TEXT    NOT NULL,
    subject        TEXT    NOT NULL,
    description    TEXT    NOT NULL,
    status         TEXT    NOT NULL DEFAULT 'Open'
                           CHECK(status IN ('Open', 'In Progress', 'Closed')),
    created_at     TEXT    NOT NULL
                           DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at     TEXT    NOT NULL
                           DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
  );

  /* Auto-stamp updated_at on every row change */
  CREATE TRIGGER IF NOT EXISTS tickets_updated_at
  AFTER UPDATE ON tickets
  FOR EACH ROW
  BEGIN
    UPDATE tickets
    SET    updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
    WHERE  id = OLD.id;
  END;

  /* ── notes ───────────────────────────────────────────────── */
  CREATE TABLE IF NOT EXISTS notes (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id  TEXT    NOT NULL
                       REFERENCES tickets(ticket_id)
                       ON DELETE CASCADE
                       ON UPDATE CASCADE,
    note_text  TEXT    NOT NULL,
    created_at TEXT    NOT NULL
                       DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
  );

  /* ── indexes ─────────────────────────────────────────────── */
  CREATE INDEX IF NOT EXISTS idx_notes_ticket_id  ON notes(ticket_id);
  CREATE INDEX IF NOT EXISTS idx_tickets_status   ON tickets(status);
  CREATE INDEX IF NOT EXISTS idx_tickets_email    ON tickets(customer_email);
`;

/* ─────────────────────────────────────────────────────────────
   PERSIST HELPER
   Write the in-memory DB back to disk after every mutation.
   ───────────────────────────────────────────────────────────── */
function persist() {
  const data = db.export();                      // Uint8Array
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

/* ─────────────────────────────────────────────────────────────
   INIT  (must be awaited once at server startup)
   ───────────────────────────────────────────────────────────── */
async function initDb() {
  if (db) return db;

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    // Load existing database from disk
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    // Fresh database
    db = new SQL.Database();
  }

  // WAL-equivalent: these pragmas improve concurrency & crash safety
  db.run('PRAGMA foreign_keys = ON;');
  db.run('PRAGMA journal_mode = MEMORY;');   // sql.js doesn't support WAL on file
  db.run('PRAGMA synchronous  = NORMAL;');
  db.run('PRAGMA temp_store   = MEMORY;');

  // Apply schema (idempotent — IF NOT EXISTS guards every statement)
  db.run(SCHEMA);

  // Initial persist to create the file if it didn't exist
  persist();

  console.log(`[DB] SQLite initialised → ${DB_PATH}`);
  return db;
}

/* ─────────────────────────────────────────────────────────────
   GET DB  (synchronous after init)
   ───────────────────────────────────────────────────────────── */
function getDb() {
  if (!db) throw new Error('Database not initialised. Call initDb() first.');
  return db;
}

/* ─────────────────────────────────────────────────────────────
   QUERY HELPERS
   Wrap sql.js's slightly verbose API in a better-sqlite3-style
   interface so controllers stay clean and readable.
   ───────────────────────────────────────────────────────────── */

/**
 * Run a SELECT and return all matching rows as plain JS objects.
 * @param {string} sql
 * @param {Record<string,any>} [params]
 * @returns {Record<string,any>[]}
 */
function queryAll(sql, params = {}) {
  const stmt    = db.prepare(sql);
  const rows    = [];

  stmt.bind(params);
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

/**
 * Run a SELECT and return only the first row, or null.
 * @param {string} sql
 * @param {Record<string,any>} [params]
 * @returns {Record<string,any> | null}
 */
function queryOne(sql, params = {}) {
  const rows = queryAll(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Run an INSERT / UPDATE / DELETE. Persists to disk automatically.
 * Do NOT call inside a transaction() block — use runInTx() there.
 * @param {string} sql
 * @param {Record<string,any>} [params]
 * @returns {{ changes: number, lastInsertRowid: number }}
 */
function run(sql, params = {}) {
  db.run(sql, params);
  persist();
  const meta = queryOne('SELECT last_insert_rowid() AS lid, changes() AS chg');
  return {
    lastInsertRowid: meta.lid,
    changes:         meta.chg,
  };
}

/**
 * Run a mutating statement INSIDE an active transaction.
 * Does NOT persist (the wrapping transaction() call handles that).
 * @param {string} sql
 * @param {Record<string,any>} [params]
 */
function runInTx(sql, params = {}) {
  db.run(sql, params);
}

/**
 * Execute a block of statements atomically inside a transaction.
 * Use runInTx() for mutations inside fn — not run().
 * Rolls back on any thrown error; persists on success.
 * @param {() => any} fn
 * @returns {any} Return value of fn
 */
function transaction(fn) {
  db.run('BEGIN TRANSACTION;');
  try {
    const result = fn();
    db.run('COMMIT;');
    persist();
    return result;
  } catch (err) {
    try { db.run('ROLLBACK;'); } catch (_) { /* already rolled back */ }
    throw err;
  }
}

/* ─────────────────────────────────────────────────────────────
   TICKET ID GENERATOR
   ───────────────────────────────────────────────────────────── */

/**
 * Generates the next collision-safe ticket_id (e.g. "TKT-007").
 *
 * Strategy: read the current AUTOINCREMENT sequence counter from
 * sqlite_sequence — the highest integer PK ever issued for the
 * tickets table. Adding 1 gives the exact ID the next INSERT will
 * receive, which we format as the human-readable TKT-XXX string.
 *
 * This is called INSIDE a transaction in createTicket, so between
 * reading the sequence and committing the INSERT, no other request
 * can interleave. sql.js is single-threaded (one JS event loop),
 * and the UNIQUE constraint on ticket_id is the final safety net.
 *
 * Why NOT COUNT(*)?
 *   After deleting ticket row #3: COUNT = 4, but next AUTOINCREMENT
 *   = 6. Using COUNT would silently re-issue TKT-005. Using
 *   sqlite_sequence always reflects the high-water mark.
 *
 * @returns {string}  e.g. "TKT-001"
 */
function generateTicketId() {
  const row = queryOne(
    `SELECT seq FROM sqlite_sequence WHERE name = 'tickets'`
  );
  // Row is absent until the very first ticket is inserted
  const nextNum = row ? Number(row.seq) + 1 : 1;
  return `TKT-${String(nextNum).padStart(3, '0')}`;
}

/* ─────────────────────────────────────────────────────────────
   EXPORTS
   ───────────────────────────────────────────────────────────── */
module.exports = {
  initDb,
  getDb,
  queryAll,
  queryOne,
  run,
  runInTx,
  transaction,
  generateTicketId,
};