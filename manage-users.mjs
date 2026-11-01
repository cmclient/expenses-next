#!/usr/bin/env node

// manage-users.mjs - CLI script for managing Expenses users
// Usage: node manage-users.mjs <command> [options]

import fs from "fs";
import path from "path";
import { createHash, randomBytes } from "crypto";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.STORAGE_URL || path.join(__dirname, "data");
const USERS_PATH = path.join(DATA_DIR, "users.json");
const PERSISTENCE_MODE = (process.env.PERSISTENCE_MODE || "JSON").toUpperCase();

let bcrypt;
try {
  bcrypt = (await import("bcryptjs")).default;
} catch {
  console.error("Error: bcryptjs not installed. Run: npm install");
  process.exit(1);
}

let uuid;
try {
  uuid = (await import("uuid")).v4;
} catch {
  console.error("Error: uuid not installed. Run: npm install");
  process.exit(1);
}

let Database;
if (PERSISTENCE_MODE === "SQLITE") {
  try {
    Database = (await import("better-sqlite3")).default;
  } catch {
    console.error("Error: better-sqlite3 not installed. Run: npm install");
    process.exit(1);
  }
}

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// ---- SQLite helpers ----

let _db = null;

function getSqliteDb() {
  if (_db) return _db;
  ensureDir();
  const dbPath = process.env.SQLITE_PATH || path.join(DATA_DIR, "expenses.sqlite");
  _db = new Database(dbPath);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");
  _db.exec(`
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
    )
  `);
  return _db;
}

function sqliteRowToUser(row) {
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
  if (row.twofaBackupCodes) user.twofaBackupCodes = JSON.parse(row.twofaBackupCodes);
  return user;
}

// ---- Persistence-aware getters/setters ----

function getUsers() {
  if (PERSISTENCE_MODE === "SQLITE") {
    const db = getSqliteDb();
    return db.prepare("SELECT * FROM users").all().map(sqliteRowToUser);
  }

  ensureDir();
  if (!fs.existsSync(USERS_PATH)) {
    return [];
  }
  const raw = fs.readFileSync(USERS_PATH, "utf-8");
  const data = JSON.parse(raw);
  return data.users || [];
}

function saveUsers(users) {
  if (PERSISTENCE_MODE === "SQLITE") {
    const db = getSqliteDb();
    const upsert = db.prepare(`
      INSERT OR REPLACE INTO users
        (id, username, password, isAdmin, avatar, twofaSecret, twofaEnabled, twofaBackupCodes, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const del = db.prepare("DELETE FROM users WHERE id = ?");

    db.transaction(() => {
      const existingIds = db.prepare("SELECT id FROM users").all().map((r) => r.id);
      const newIds = new Set(users.map((u) => u.id));

      for (const id of existingIds) {
        if (!newIds.has(id)) del.run(id);
      }

      for (const u of users) {
        upsert.run(
          u.id, u.username, u.password,
          u.isAdmin ? 1 : 0,
          u.avatar || null,
          u.twofaSecret || null,
          u.twofaEnabled ? 1 : 0,
          u.twofaBackupCodes ? JSON.stringify(u.twofaBackupCodes) : null,
          u.createdAt, u.updatedAt
        );
      }
    })();
    return;
  }

  ensureDir();
  fs.writeFileSync(USERS_PATH, JSON.stringify({ users }, null, 4));
}

const [, , command, ...args] = process.argv;

function usage() {
  console.log(`
  Expenses - User Management CLI

  Usage: node manage-users.mjs <command> [options]

  Commands:
    list                          List all users
    add <username> <password>     Add a new user
    add-admin <username> <password>  Add a new admin user
    remove <username>             Remove a user
    reset-password <username> <password>  Reset a user's password
    set-admin <username> <true|false>    Set admin status
    info <username>               Show user details

  Environment:
    STORAGE_URL        Data directory path (default: ./data)
    PERSISTENCE_MODE   JSON or SQLITE (default: JSON)
    SQLITE_PATH        SQLite file path (default: ./data/expenses.sqlite)

  Current mode: ${PERSISTENCE_MODE}
`);
}

async function main() {
  switch (command) {
    case "list": {
      const users = getUsers();
      if (users.length === 0) {
        console.log("No users found.");
        return;
      }
      console.log(`\n  Users (${users.length}) [${PERSISTENCE_MODE}]:\n`);
      for (const u of users) {
        const admin = u.isAdmin ? " [ADMIN]" : "";
        console.log(`  - ${u.username}${admin}  (id: ${u.id}, created: ${u.createdAt})`);
      }
      console.log();
      break;
    }

    case "add":
    case "add-admin": {
      const [username, password] = args;
      if (!username || !password) {
        console.error("Usage: manage-users.mjs add <username> <password>");
        process.exit(1);
      }
      if (username.length < 3 || username.length > 32) {
        console.error("Error: Username must be 3-32 characters.");
        process.exit(1);
      }
      if (password.length < 6) {
        console.error("Error: Password must be at least 6 characters.");
        process.exit(1);
      }

      const users = getUsers();
      if (users.find((u) => u.username === username)) {
        console.error(`Error: User "${username}" already exists.`);
        process.exit(1);
      }

      const hash = await bcrypt.hash(password, 12);
      const now = new Date().toISOString();
      const isAdmin = command === "add-admin";

      users.push({
        id: uuid(),
        username,
        password: hash,
        isAdmin,
        createdAt: now,
        updatedAt: now,
      });

      saveUsers(users);
      console.log(`User "${username}" created${isAdmin ? " as admin" : ""}.`);
      break;
    }

    case "remove": {
      const [username] = args;
      if (!username) {
        console.error("Usage: manage-users.mjs remove <username>");
        process.exit(1);
      }

      const users = getUsers();
      const filtered = users.filter((u) => u.username !== username);
      if (filtered.length === users.length) {
        console.error(`Error: User "${username}" not found.`);
        process.exit(1);
      }

      saveUsers(filtered);
      console.log(`User "${username}" removed.`);
      break;
    }

    case "reset-password": {
      const [username, password] = args;
      if (!username || !password) {
        console.error("Usage: manage-users.mjs reset-password <username> <password>");
        process.exit(1);
      }
      if (password.length < 6) {
        console.error("Error: Password must be at least 6 characters.");
        process.exit(1);
      }

      const users = getUsers();
      const user = users.find((u) => u.username === username);
      if (!user) {
        console.error(`Error: User "${username}" not found.`);
        process.exit(1);
      }

      user.password = await bcrypt.hash(password, 12);
      user.updatedAt = new Date().toISOString();
      saveUsers(users);
      console.log(`Password reset for "${username}".`);
      break;
    }

    case "set-admin": {
      const [username, value] = args;
      if (!username || !value) {
        console.error("Usage: manage-users.mjs set-admin <username> <true|false>");
        process.exit(1);
      }

      const isAdmin = value === "true";
      const users = getUsers();
      const user = users.find((u) => u.username === username);
      if (!user) {
        console.error(`Error: User "${username}" not found.`);
        process.exit(1);
      }

      user.isAdmin = isAdmin;
      user.updatedAt = new Date().toISOString();
      saveUsers(users);
      console.log(`User "${username}" admin status set to ${isAdmin}.`);
      break;
    }

    case "info": {
      const [username] = args;
      if (!username) {
        console.error("Usage: manage-users.mjs info <username>");
        process.exit(1);
      }

      const users = getUsers();
      const user = users.find((u) => u.username === username);
      if (!user) {
        console.error(`Error: User "${username}" not found.`);
        process.exit(1);
      }

      console.log(`\n  User: ${user.username}`);
      console.log(`  ID: ${user.id}`);
      console.log(`  Admin: ${user.isAdmin}`);
      console.log(`  Created: ${user.createdAt}`);
      console.log(`  Updated: ${user.updatedAt}`);
      console.log(`  Mode: ${PERSISTENCE_MODE}\n`);
      break;
    }

    default:
      usage();
      break;
  }
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
