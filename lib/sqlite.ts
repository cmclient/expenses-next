import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import {
  ActivityLog,
  AppConfig,
  DEFAULT_CATEGORIES,
  Expense,
  Reminder,
  ReminderAlertConfig,
  User,
  WebPushSubscription,
} from "./types";

const DATA_DIR = process.env.STORAGE_URL || path.join(process.cwd(), "data");
const MAX_ACTIVITY_LOGS = 500;

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// ---- Singleton (survives Next.js hot reloads) ----

const g = globalThis as Record<string, unknown>;

export function getSqliteDb(): Database.Database {
  if (!g.__expenses_sqliteDb) {
    initSqlite();
  }
  return g.__expenses_sqliteDb as Database.Database;
}

function initSqlite() {
  ensureDir(DATA_DIR);
  const dbPath =
    process.env.SQLITE_PATH || path.join(DATA_DIR, "expenses.sqlite");
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

  g.__expenses_sqliteDb = db;

  startAutoBackup(db);
}

// ---- Auto Backup ----

function startAutoBackup(db: Database.Database) {
  if (g.__expenses_backupStarted) return;
  g.__expenses_backupStarted = true;

  const intervalHours = parseInt(
    process.env.SQLITE_BACKUP_INTERVAL_HOURS || "6",
    10
  );
  const maxBackups = parseInt(process.env.SQLITE_BACKUP_COUNT || "5", 10);

  const doBackup = () => {
    try {
      const backupDir = path.join(DATA_DIR, "backups");
      ensureDir(backupDir);

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const backupPath = path.join(
        backupDir,
        `expenses-${timestamp}.sqlite`
      );

      db.backup(backupPath)
        .then(() => {
          const files = fs
            .readdirSync(backupDir)
            .filter(
              (f) => f.startsWith("expenses-") && f.endsWith(".sqlite")
            )
            .sort()
            .reverse();

          for (const file of files.slice(maxBackups)) {
            fs.unlinkSync(path.join(backupDir, file));
          }
          console.log(`[SQLite] Backup created: ${backupPath}`);
        })
        .catch((err: Error) => {
          console.error("[SQLite] Backup failed:", err.message);
        });
    } catch (err: unknown) {
      console.error(
        "[SQLite] Backup failed:",
        err instanceof Error ? err.message : err
      );
    }
  };

  setTimeout(doBackup, 5000);
  setInterval(doBackup, intervalHours * 60 * 60 * 1000);
}

// ---- Row ↔ Object mapping ----

function rowToUser(row: Record<string, unknown>): User {
  const user: User = {
    id: row.id as string,
    username: row.username as string,
    password: row.password as string,
    isAdmin: Boolean(row.isAdmin),
    createdAt: row.createdAt as string,
    updatedAt: row.updatedAt as string,
  };
  if (row.avatar) user.avatar = row.avatar as string;
  if (row.twofaSecret) user.twofaSecret = row.twofaSecret as string;
  if (row.twofaEnabled) user.twofaEnabled = Boolean(row.twofaEnabled);
  if (row.twofaBackupCodes)
    user.twofaBackupCodes = JSON.parse(row.twofaBackupCodes as string);
  return user;
}

function rowToExpense(row: Record<string, unknown>): Expense {
  return {
    id: row.id as string,
    recurringID: row.recurringID as string,
    name: row.name as string,
    tags: JSON.parse(row.tags as string),
    category: row.category as string,
    amount: row.amount as number,
    currency: row.currency as string,
    date: row.date as string,
  };
}

function rowToReminder(row: Record<string, unknown>): Reminder {
  const reminder: Reminder = {
    id: row.id as string,
    name: row.name as string,
    payer: row.payer as string,
    category: row.category as string,
    amount: row.amount as number,
    currency: row.currency as string,
    intervalAmount: row.intervalAmount as number,
    intervalType: row.intervalType as "daily" | "weekly" | "monthly" | "yearly",
    startDate: row.startDate as string,
    nextDueDate: row.nextDueDate as string,
    alerts: JSON.parse(row.alerts as string) as ReminderAlertConfig,
    paid: Boolean(row.paid),
    createdAt: row.createdAt as string,
  };
  if (row.paidAt) reminder.paidAt = row.paidAt as string;
  if (row.lastAlertSentAt)
    reminder.lastAlertSentAt = row.lastAlertSentAt as string;
  return reminder;
}

function rowToPushSubscription(
  row: Record<string, unknown>
): WebPushSubscription {
  return {
    endpoint: row.endpoint as string,
    expirationTime: (row.expirationTime as number | null) ?? null,
    keys: {
      p256dh: row.p256dh as string,
      auth: row.auth as string,
    },
    createdAt: row.createdAt as string,
  };
}

function rowToActivityLog(row: Record<string, unknown>): ActivityLog {
  const log: ActivityLog = {
    id: row.id as string,
    action: row.action as ActivityLog["action"],
    timestamp: row.timestamp as string,
  };
  if (row.details) log.details = row.details as string;
  if (row.metadata)
    log.metadata = JSON.parse(row.metadata as string);
  if (row.ip) log.ip = row.ip as string;
  if (row.userAgent) log.userAgent = row.userAgent as string;
  return log;
}

// ---- Users ----

export function sqliteGetUsers(): User[] {
  const db = getSqliteDb();
  const rows = db.prepare("SELECT * FROM users").all();
  return rows.map((r) => rowToUser(r as Record<string, unknown>));
}

export function sqliteSaveUsers(users: User[]): void {
  const db = getSqliteDb();
  const upsert = db.prepare(`
    INSERT OR REPLACE INTO users
      (id, username, password, isAdmin, avatar, twofaSecret, twofaEnabled, twofaBackupCodes, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const del = db.prepare("DELETE FROM users WHERE id = ?");

  db.transaction(() => {
    const existingIds = (
      db.prepare("SELECT id FROM users").all() as { id: string }[]
    ).map((r) => r.id);
    const newIds = new Set(users.map((u) => u.id));

    for (const id of existingIds) {
      if (!newIds.has(id)) del.run(id);
    }

    for (const u of users) {
      upsert.run(
        u.id,
        u.username,
        u.password,
        u.isAdmin ? 1 : 0,
        u.avatar || null,
        u.twofaSecret || null,
        u.twofaEnabled ? 1 : 0,
        u.twofaBackupCodes ? JSON.stringify(u.twofaBackupCodes) : null,
        u.createdAt,
        u.updatedAt
      );
    }
  })();
}

export function sqliteGetUserByUsername(username: string): User | undefined {
  const db = getSqliteDb();
  const row = db
    .prepare("SELECT * FROM users WHERE username = ?")
    .get(username);
  return row ? rowToUser(row as Record<string, unknown>) : undefined;
}

export function sqliteGetUserById(id: string): User | undefined {
  const db = getSqliteDb();
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
  return row ? rowToUser(row as Record<string, unknown>) : undefined;
}

// ---- Config ----

export function sqliteGetConfig(userId: string): AppConfig {
  const db = getSqliteDb();
  const row = db
    .prepare("SELECT * FROM config WHERE userId = ?")
    .get(userId) as Record<string, unknown> | undefined;

  if (!row) {
    const defaultConfig: AppConfig = {
      categories: [...DEFAULT_CATEGORIES],
      currency: "usd",
      startDate: 1,
      recurringExpenses: [],
    };
    db.prepare(
      `INSERT INTO config (userId, categories, currency, startDate, recurringExpenses)
       VALUES (?, ?, ?, ?, ?)`
    ).run(
      userId,
      JSON.stringify(defaultConfig.categories),
      defaultConfig.currency,
      defaultConfig.startDate,
      JSON.stringify(defaultConfig.recurringExpenses)
    );
    return defaultConfig;
  }

  return {
    categories: JSON.parse(row.categories as string),
    currency: row.currency as string,
    startDate: row.startDate as number,
    recurringExpenses: JSON.parse(row.recurringExpenses as string),
  };
}

export function sqliteSaveConfig(userId: string, config: AppConfig): void {
  const db = getSqliteDb();
  db.prepare(
    `INSERT OR REPLACE INTO config (userId, categories, currency, startDate, recurringExpenses)
     VALUES (?, ?, ?, ?, ?)`
  ).run(
    userId,
    JSON.stringify(config.categories),
    config.currency,
    config.startDate,
    JSON.stringify(config.recurringExpenses)
  );
}

// ---- Expenses ----

export function sqliteGetExpenses(userId: string): Expense[] {
  const db = getSqliteDb();
  const rows = db
    .prepare("SELECT * FROM expenses WHERE userId = ?")
    .all(userId);
  return rows.map((r) => rowToExpense(r as Record<string, unknown>));
}

export function sqliteSaveExpenses(
  userId: string,
  expenses: Expense[]
): void {
  const db = getSqliteDb();
  const insert = db.prepare(`
    INSERT INTO expenses (id, userId, recurringID, name, tags, category, amount, currency, date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  db.transaction(() => {
    db.prepare("DELETE FROM expenses WHERE userId = ?").run(userId);
    for (const e of expenses) {
      insert.run(
        e.id,
        userId,
        e.recurringID,
        e.name,
        JSON.stringify(e.tags),
        e.category,
        e.amount,
        e.currency,
        e.date
      );
    }
  })();
}

// ---- Reminders ----

export function sqliteGetReminders(userId: string): Reminder[] {
  const db = getSqliteDb();
  const rows = db
    .prepare("SELECT * FROM reminders WHERE userId = ?")
    .all(userId);
  return rows.map((r) => rowToReminder(r as Record<string, unknown>));
}

export function sqliteSaveReminders(
  userId: string,
  reminders: Reminder[]
): void {
  const db = getSqliteDb();
  const insert = db.prepare(`
    INSERT INTO reminders
      (id, userId, name, payer, category, amount, currency, intervalAmount, intervalType,
       startDate, nextDueDate, alerts, paid, paidAt, lastAlertSentAt, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  db.transaction(() => {
    db.prepare("DELETE FROM reminders WHERE userId = ?").run(userId);
    for (const r of reminders) {
      insert.run(
        r.id,
        userId,
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
  })();
}

// ---- Push Subscriptions ----

export function sqliteGetPushSubscriptions(
  userId: string
): WebPushSubscription[] {
  const db = getSqliteDb();
  const rows = db
    .prepare("SELECT * FROM push_subscriptions WHERE userId = ?")
    .all(userId);
  return rows.map((r) =>
    rowToPushSubscription(r as Record<string, unknown>)
  );
}

export function sqliteSavePushSubscriptions(
  userId: string,
  subscriptions: WebPushSubscription[]
): void {
  const db = getSqliteDb();
  const insert = db.prepare(`
    INSERT INTO push_subscriptions (userId, endpoint, expirationTime, p256dh, auth, createdAt)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  db.transaction(() => {
    db.prepare("DELETE FROM push_subscriptions WHERE userId = ?").run(userId);
    for (const s of subscriptions) {
      insert.run(
        userId,
        s.endpoint,
        s.expirationTime ?? null,
        s.keys.p256dh,
        s.keys.auth,
        s.createdAt
      );
    }
  })();
}

// ---- Activity Logs ----

export function sqliteGetActivityLogs(userId: string): ActivityLog[] {
  const db = getSqliteDb();
  const rows = db
    .prepare(
      "SELECT * FROM activity_logs WHERE userId = ? ORDER BY timestamp DESC LIMIT ?"
    )
    .all(userId, MAX_ACTIVITY_LOGS);
  return rows.map((r) => rowToActivityLog(r as Record<string, unknown>));
}

export function sqliteAppendActivityLog(
  userId: string,
  log: ActivityLog
): void {
  const db = getSqliteDb();
  db.transaction(() => {
    db.prepare(
      `INSERT INTO activity_logs (id, userId, action, details, metadata, ip, userAgent, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      log.id,
      userId,
      log.action,
      log.details || null,
      log.metadata ? JSON.stringify(log.metadata) : null,
      log.ip || null,
      log.userAgent || null,
      log.timestamp
    );

    const count = (
      db
        .prepare(
          "SELECT COUNT(*) as cnt FROM activity_logs WHERE userId = ?"
        )
        .get(userId) as { cnt: number }
    ).cnt;

    if (count > MAX_ACTIVITY_LOGS) {
      db.prepare(
        `DELETE FROM activity_logs WHERE userId = ? AND id NOT IN (
          SELECT id FROM activity_logs WHERE userId = ? ORDER BY timestamp DESC LIMIT ?
        )`
      ).run(userId, userId, MAX_ACTIVITY_LOGS);
    }
  })();
}
