#!/usr/bin/env node
/**
 * migrate.mjs — Expenses data migration tool
 *
 * Reads data from one persistence backend and writes it to another.
 * Output is always placed in the ./output/ directory.
 *
 * Usage:
 *   node migrate.mjs <from> <to> [options]
 *
 * Backends:
 *   json     — Uses ./data/ directory structure (users.json + per-user dirs)
 *   sqlite   — Uses ./data/expenses.sqlite (or --sqlite-path=<path>)
 *
 * Options:
 *   --sqlite-path=<path>  Path to SQLite DB file
 *   --json-dir=<dir>      Path to JSON data directory (default: ./data)
 *
 * Examples:
 *   node migrate.mjs json sqlite
 *   node migrate.mjs sqlite json
 *   node migrate.mjs json sqlite --json-dir=./backup/data
 *   node migrate.mjs sqlite json --sqlite-path=./backup/expenses.sqlite
 */

import "dotenv/config";
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, "output");

// ── CLI parsing ────────────────────────────────────────────

const args = process.argv.slice(2);
const flags = args.filter((a) => a.startsWith("--"));
const positional = args.filter((a) => !a.startsWith("--"));

function getFlag(name) {
  const f = flags.find((f) => f.startsWith(`--${name}=`));
  return f ? f.split("=").slice(1).join("=") : undefined;
}

const VALID_BACKENDS = ["json", "sqlite"];

if (
  positional.length < 2 ||
  positional.includes("help") ||
  flags.includes("--help")
) {
  console.log(`
  Usage: node migrate.mjs <from> <to> [options]

  Backends: json, sqlite

  Options:
    --sqlite-path=<path>  Path to SQLite DB file
    --json-dir=<dir>      Path to JSON data directory (default: ./data)

  Examples:
    node migrate.mjs json sqlite
    node migrate.mjs sqlite json
    node migrate.mjs json sqlite --json-dir=./backup/data
    node migrate.mjs sqlite json --sqlite-path=./backup/expenses.sqlite
`);
  process.exit(
    positional.includes("help") || flags.includes("--help") ? 0 : 1
  );
}

const fromBackend = positional[0].toLowerCase();
const toBackend = positional[1].toLowerCase();

if (!VALID_BACKENDS.includes(fromBackend)) {
  console.error(
    `Invalid source backend: "${fromBackend}". Must be one of: ${VALID_BACKENDS.join(", ")}`
  );
  process.exit(1);
}
if (!VALID_BACKENDS.includes(toBackend)) {
  console.error(
    `Invalid target backend: "${toBackend}". Must be one of: ${VALID_BACKENDS.join(", ")}`
  );
  process.exit(1);
}
if (fromBackend === toBackend) {
  console.error(`Source and target are the same: "${fromBackend}"`);
  process.exit(1);
}

// ── Helpers ────────────────────────────────────────────────

function ts() {
  return new Date().toISOString();
}
function info(msg) {
  console.log(`[${ts()}] [INFO]  ${msg}`);
}
function warn(msg) {
  console.log(`[${ts()}] [WARN]  ${msg}`);
}
function error(msg) {
  console.error(`[${ts()}] [ERROR] ${msg}`);
}

function formatBytes(b) {
  if (b === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(b) / Math.log(k));
  return (b / Math.pow(k, i)).toFixed(i > 0 ? 2 : 0) + " " + sizes[i];
}

function resolveSqlitePath() {
  return (
    getFlag("sqlite-path") ||
    process.env.SQLITE_PATH ||
    path.join(__dirname, "data", "expenses.sqlite")
  );
}

function resolveJsonDir() {
  return getFlag("json-dir") || path.join(__dirname, "data");
}

function readJsonFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

// ── Readers ────────────────────────────────────────────────

function readFromJson() {
  const dir = resolveJsonDir();
  info(`Reading JSON files from: ${dir}`);

  const usersFile = path.join(dir, "users.json");
  const usersData = readJsonFile(usersFile);
  const users = usersData?.users || [];

  info(`  Found ${users.length} user(s)`);

  const userData = {};
  for (const user of users) {
    const userDir = path.join(dir, "users", user.id);
    const config = readJsonFile(path.join(userDir, "config.json"));
    const expenses = readJsonFile(path.join(userDir, "expenses.json"));
    const reminders = readJsonFile(path.join(userDir, "reminders.json"));
    const pushSubs = readJsonFile(
      path.join(userDir, "push-subscriptions.json")
    );
    const activity = readJsonFile(path.join(userDir, "activity.json"));

    userData[user.id] = {
      config: config || {
        categories: [
          "Food",
          "Groceries",
          "Travel",
          "Rent",
          "Utilities",
          "Entertainment",
          "Healthcare",
          "Shopping",
          "Miscellaneous",
          "Income",
        ],
        currency: "usd",
        startDate: 1,
        recurringExpenses: [],
      },
      expenses: expenses?.expenses || [],
      reminders: reminders?.reminders || [],
      pushSubscriptions: pushSubs?.subscriptions || [],
      activityLogs: activity?.logs || [],
    };

    info(
      `  User "${user.username}": ${userData[user.id].expenses.length} expenses, ${userData[user.id].reminders.length} reminders, ${userData[user.id].activityLogs.length} logs`
    );
  }

  return { users, userData };
}

function readFromSqlite() {
  const dbPath = resolveSqlitePath();
  if (!fs.existsSync(dbPath)) {
    error(`SQLite DB not found: ${dbPath}`);
    process.exit(1);
  }

  info(`Reading SQLite DB: ${dbPath}`);
  const db = new Database(dbPath, { readonly: true });

  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table'")
    .all()
    .map((r) => r.name);

  const users = tables.includes("users")
    ? db
        .prepare("SELECT * FROM users")
        .all()
        .map((row) => {
          const user = {
            id: row.id,
            username: row.username,
            password: row.password,
            isAdmin: Boolean(row.isAdmin),
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
          };
          if (row.avatar) user.avatar = row.avatar;
          if (row.twofaSecret) user.twofaSecret = row.twofaSecret;
          if (row.twofaEnabled) user.twofaEnabled = Boolean(row.twofaEnabled);
          if (row.twofaBackupCodes)
            user.twofaBackupCodes = JSON.parse(row.twofaBackupCodes);
          return user;
        })
    : [];

  info(`  Found ${users.length} user(s)`);

  const userData = {};
  for (const user of users) {
    const config = tables.includes("config")
      ? db.prepare("SELECT * FROM config WHERE userId = ?").get(user.id)
      : null;
    const expenses = tables.includes("expenses")
      ? db.prepare("SELECT * FROM expenses WHERE userId = ?").all(user.id)
      : [];
    const reminders = tables.includes("reminders")
      ? db.prepare("SELECT * FROM reminders WHERE userId = ?").all(user.id)
      : [];
    const pushSubs = tables.includes("push_subscriptions")
      ? db
          .prepare("SELECT * FROM push_subscriptions WHERE userId = ?")
          .all(user.id)
      : [];
    const activityLogs = tables.includes("activity_logs")
      ? db
          .prepare(
            "SELECT * FROM activity_logs WHERE userId = ? ORDER BY timestamp DESC"
          )
          .all(user.id)
      : [];

    userData[user.id] = {
      config: config
        ? {
            categories: JSON.parse(config.categories),
            currency: config.currency,
            startDate: config.startDate,
            recurringExpenses: JSON.parse(config.recurringExpenses),
          }
        : {
            categories: [
              "Food",
              "Groceries",
              "Travel",
              "Rent",
              "Utilities",
              "Entertainment",
              "Healthcare",
              "Shopping",
              "Miscellaneous",
              "Income",
            ],
            currency: "usd",
            startDate: 1,
            recurringExpenses: [],
          },
      expenses: expenses.map((e) => ({
        id: e.id,
        recurringID: e.recurringID,
        name: e.name,
        tags: JSON.parse(e.tags),
        category: e.category,
        amount: e.amount,
        currency: e.currency,
        date: e.date,
      })),
      reminders: reminders.map((r) => {
        const rem = {
          id: r.id,
          name: r.name,
          payer: r.payer,
          category: r.category,
          amount: r.amount,
          currency: r.currency,
          intervalAmount: r.intervalAmount,
          intervalType: r.intervalType,
          startDate: r.startDate,
          nextDueDate: r.nextDueDate,
          alerts: JSON.parse(r.alerts),
          paid: Boolean(r.paid),
          createdAt: r.createdAt,
        };
        if (r.paidAt) rem.paidAt = r.paidAt;
        if (r.lastAlertSentAt) rem.lastAlertSentAt = r.lastAlertSentAt;
        return rem;
      }),
      pushSubscriptions: pushSubs.map((s) => ({
        endpoint: s.endpoint,
        expirationTime: s.expirationTime ?? null,
        keys: { p256dh: s.p256dh, auth: s.auth },
        createdAt: s.createdAt,
      })),
      activityLogs: activityLogs.map((l) => {
        const log = {
          id: l.id,
          action: l.action,
          timestamp: l.timestamp,
        };
        if (l.details) log.details = l.details;
        if (l.metadata) log.metadata = JSON.parse(l.metadata);
        if (l.ip) log.ip = l.ip;
        if (l.userAgent) log.userAgent = l.userAgent;
        return log;
      }),
    };

    info(
      `  User "${user.username}": ${userData[user.id].expenses.length} expenses, ${userData[user.id].reminders.length} reminders, ${userData[user.id].activityLogs.length} logs`
    );
  }

  db.close();
  return { users, userData };
}

// ── Writers ────────────────────────────────────────────────

function writeToJson(data) {
  const outDir = path.join(OUTPUT_DIR, "data");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  // Write users.json
  fs.writeFileSync(
    path.join(outDir, "users.json"),
    JSON.stringify({ users: data.users }, null, 4)
  );
  info(`  ${data.users.length} users -> users.json`);

  // Write per-user data
  for (const user of data.users) {
    const ud = data.userData[user.id];
    if (!ud) continue;

    const userDir = path.join(outDir, "users", user.id);
    if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true });

    fs.writeFileSync(
      path.join(userDir, "config.json"),
      JSON.stringify(ud.config, null, 4)
    );
    fs.writeFileSync(
      path.join(userDir, "expenses.json"),
      JSON.stringify({ expenses: ud.expenses }, null, 4)
    );
    fs.writeFileSync(
      path.join(userDir, "reminders.json"),
      JSON.stringify({ reminders: ud.reminders }, null, 4)
    );
    fs.writeFileSync(
      path.join(userDir, "push-subscriptions.json"),
      JSON.stringify({ subscriptions: ud.pushSubscriptions }, null, 4)
    );
    fs.writeFileSync(
      path.join(userDir, "activity.json"),
      JSON.stringify({ logs: ud.activityLogs }, null, 4)
    );

    info(
      `  User "${user.username}": ${ud.expenses.length} expenses, ${ud.reminders.length} reminders, ${ud.activityLogs.length} logs`
    );
  }
}

function writeToSqlite(data) {
  const dbPath = path.join(OUTPUT_DIR, "expenses.sqlite");

  if (fs.existsSync(dbPath)) {
    const backupPath = dbPath + `.bak-${Date.now()}`;
    fs.copyFileSync(dbPath, backupPath);
    warn(`Existing DB backed up to ${path.relative(__dirname, backupPath)}`);
  }

  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      isAdmin INTEGER NOT NULL DEFAULT 0,
      avatar TEXT,
      twofaSecret TEXT,
      twofaEnabled INTEGER NOT NULL DEFAULT 0,
      twofaBackupCodes TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS config (
      userId TEXT PRIMARY KEY,
      categories TEXT NOT NULL DEFAULT '[]',
      currency TEXT NOT NULL DEFAULT 'usd',
      startDate INTEGER NOT NULL DEFAULT 1,
      recurringExpenses TEXT NOT NULL DEFAULT '[]',
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      recurringID TEXT NOT NULL DEFAULT '',
      name TEXT NOT NULL,
      tags TEXT NOT NULL DEFAULT '[]',
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT NOT NULL,
      date TEXT NOT NULL,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS reminders (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      name TEXT NOT NULL,
      payer TEXT NOT NULL,
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT NOT NULL,
      intervalAmount INTEGER NOT NULL,
      intervalType TEXT NOT NULL,
      startDate TEXT NOT NULL,
      nextDueDate TEXT NOT NULL,
      alerts TEXT NOT NULL DEFAULT '{}',
      paid INTEGER NOT NULL DEFAULT 0,
      paidAt TEXT,
      lastAlertSentAt TEXT,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      expirationTime INTEGER,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS activity_logs (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      action TEXT NOT NULL,
      details TEXT,
      metadata TEXT,
      ip TEXT,
      userAgent TEXT,
      timestamp TEXT NOT NULL,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_expenses_userId ON expenses(userId);
    CREATE INDEX IF NOT EXISTS idx_reminders_userId ON reminders(userId);
    CREATE INDEX IF NOT EXISTS idx_push_subs_userId ON push_subscriptions(userId);
    CREATE INDEX IF NOT EXISTS idx_activity_userId ON activity_logs(userId);
    CREATE INDEX IF NOT EXISTS idx_activity_ts ON activity_logs(userId, timestamp);
  `);

  // Insert users
  const insertUser = db.prepare(`
    INSERT OR REPLACE INTO users
      (id, username, password, isAdmin, avatar, twofaSecret, twofaEnabled, twofaBackupCodes, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertConfig = db.prepare(`
    INSERT OR REPLACE INTO config (userId, categories, currency, startDate, recurringExpenses)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertExpense = db.prepare(`
    INSERT INTO expenses (id, userId, recurringID, name, tags, category, amount, currency, date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertReminder = db.prepare(`
    INSERT INTO reminders
      (id, userId, name, payer, category, amount, currency, intervalAmount, intervalType,
       startDate, nextDueDate, alerts, paid, paidAt, lastAlertSentAt, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertPushSub = db.prepare(`
    INSERT INTO push_subscriptions (userId, endpoint, expirationTime, p256dh, auth, createdAt)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertActivityLog = db.prepare(`
    INSERT INTO activity_logs (id, userId, action, details, metadata, ip, userAgent, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  db.transaction(() => {
    for (const user of data.users) {
      insertUser.run(
        user.id,
        user.username,
        user.password,
        user.isAdmin ? 1 : 0,
        user.avatar || null,
        user.twofaSecret || null,
        user.twofaEnabled ? 1 : 0,
        user.twofaBackupCodes
          ? JSON.stringify(user.twofaBackupCodes)
          : null,
        user.createdAt,
        user.updatedAt
      );

      const ud = data.userData[user.id];
      if (!ud) continue;

      // Config
      insertConfig.run(
        user.id,
        JSON.stringify(ud.config.categories),
        ud.config.currency,
        ud.config.startDate,
        JSON.stringify(ud.config.recurringExpenses)
      );

      // Expenses
      for (const e of ud.expenses) {
        insertExpense.run(
          e.id,
          user.id,
          e.recurringID,
          e.name,
          JSON.stringify(e.tags),
          e.category,
          e.amount,
          e.currency,
          e.date
        );
      }

      // Reminders
      for (const r of ud.reminders) {
        insertReminder.run(
          r.id,
          user.id,
          r.name,
          r.payer,
          r.category,
          r.amount,
          r.currency,
          r.intervalAmount,
          r.intervalType,
          r.startDate,
          r.nextDueDate,
          JSON.stringify(r.alerts),
          r.paid ? 1 : 0,
          r.paidAt || null,
          r.lastAlertSentAt || null,
          r.createdAt
        );
      }

      // Push subscriptions
      for (const s of ud.pushSubscriptions) {
        insertPushSub.run(
          user.id,
          s.endpoint,
          s.expirationTime ?? null,
          s.keys.p256dh,
          s.keys.auth,
          s.createdAt
        );
      }

      // Activity logs
      for (const l of ud.activityLogs) {
        insertActivityLog.run(
          l.id,
          user.id,
          l.action,
          l.details || null,
          l.metadata ? JSON.stringify(l.metadata) : null,
          l.ip || null,
          l.userAgent || null,
          l.timestamp
        );
      }

      info(
        `  User "${user.username}": ${ud.expenses.length} expenses, ${ud.reminders.length} reminders, ${ud.activityLogs.length} logs`
      );
    }
  })();

  db.close();

  const size = fs.statSync(dbPath).size;
  info(`  SQLite DB: ${path.relative(__dirname, dbPath)} (${formatBytes(size)})`);
}

// ── Main ───────────────────────────────────────────────────

async function main() {
  info(`Migration: ${fromBackend} -> ${toBackend}`);
  info("");

  // Read source
  info(`=== Reading from ${fromBackend.toUpperCase()} ===`);
  let data;
  switch (fromBackend) {
    case "json":
      data = readFromJson();
      break;
    case "sqlite":
      data = readFromSqlite();
      break;
  }

  const userCount = data.users.length;
  let totalExpenses = 0;
  let totalReminders = 0;
  let totalLogs = 0;
  for (const uid of Object.keys(data.userData)) {
    totalExpenses += data.userData[uid].expenses.length;
    totalReminders += data.userData[uid].reminders.length;
    totalLogs += data.userData[uid].activityLogs.length;
  }

  info("");
  info("Data loaded:");
  info(`  Users:      ${userCount}`);
  info(`  Expenses:   ${totalExpenses}`);
  info(`  Reminders:  ${totalReminders}`);
  info(`  Logs:       ${totalLogs}`);

  if (userCount === 0) {
    warn("No users found — nothing to migrate.");
    process.exit(0);
  }

  // Ensure output dir
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Write target
  info("");
  info(`=== Writing to ${toBackend.toUpperCase()} ===`);
  switch (toBackend) {
    case "json":
      writeToJson(data);
      break;
    case "sqlite":
      writeToSqlite(data);
      break;
  }

  info("");
  info("Migration complete!");
  info(`  Source: ${fromBackend.toUpperCase()}`);
  info(`  Target: ${toBackend.toUpperCase()}`);
  info(`  Output: ./${path.relative(__dirname, OUTPUT_DIR)}/`);
}

main().catch((e) => {
  error(e.message || e);
  process.exit(1);
});
