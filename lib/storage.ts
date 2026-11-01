import fs from "fs";
import path from "path";
import {
  ActivityLog,
  ActivityLogsFile,
  AppConfig,
  Expense,
  ExpensesFile,
  Reminder,
  RemindersFile,
  User,
  UsersFile,
  WebPushSubscription,
  WebPushSubscriptionsFile,
  DEFAULT_CATEGORIES,
} from "./types";
import {
  sqliteGetUsers,
  sqliteSaveUsers,
  sqliteGetUserByUsername,
  sqliteGetUserById,
  sqliteGetConfig,
  sqliteSaveConfig,
  sqliteGetExpenses,
  sqliteSaveExpenses,
  sqliteGetReminders,
  sqliteSaveReminders,
  sqliteGetPushSubscriptions,
  sqliteSavePushSubscriptions,
  sqliteGetActivityLogs,
  sqliteAppendActivityLog,
} from "./sqlite";

// Data directory - configurable via env, defaults to ./data
const DATA_DIR = process.env.STORAGE_URL || path.join(process.cwd(), "data");
const USERS_PATH = path.join(DATA_DIR, "users.json");

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// ---- Persistence mode ----

export type PersistenceMode = "JSON" | "SQLITE";

let _validatedMode: PersistenceMode | null = null;

export function getPersistenceMode(): PersistenceMode {
  if (_validatedMode) return _validatedMode;
  const raw = (process.env.PERSISTENCE_MODE || "JSON").toUpperCase();
  if (raw !== "JSON" && raw !== "SQLITE") {
    console.error(
      `[Storage] Invalid PERSISTENCE_MODE: "${raw}". Valid options: JSON, SQLITE`
    );
    process.exit(1);
  }
  _validatedMode = raw;
  return raw;
}

// ---- Users ----

export function getUsers(): User[] {
  if (getPersistenceMode() === "SQLITE") return sqliteGetUsers();

  ensureDir(DATA_DIR);
  if (!fs.existsSync(USERS_PATH)) {
    const initial: UsersFile = { users: [] };
    fs.writeFileSync(USERS_PATH, JSON.stringify(initial, null, 4));
    return [];
  }
  const raw = fs.readFileSync(USERS_PATH, "utf-8");
  const data = JSON.parse(raw) as UsersFile;
  return data.users || [];
}

export function saveUsers(users: User[]) {
  if (getPersistenceMode() === "SQLITE") return sqliteSaveUsers(users);

  ensureDir(DATA_DIR);
  fs.writeFileSync(USERS_PATH, JSON.stringify({ users }, null, 4));
}

export function getUserByUsername(username: string): User | undefined {
  if (getPersistenceMode() === "SQLITE")
    return sqliteGetUserByUsername(username);

  return getUsers().find((u) => u.username === username);
}

export function getUserById(id: string): User | undefined {
  if (getPersistenceMode() === "SQLITE") return sqliteGetUserById(id);

  return getUsers().find((u) => u.id === id);
}

// ---- Per-user data directories (JSON mode) ----

function userDataDir(userId: string): string {
  return path.join(DATA_DIR, "users", userId);
}

function userConfigPath(userId: string): string {
  return path.join(userDataDir(userId), "config.json");
}

function userExpensesPath(userId: string): string {
  return path.join(userDataDir(userId), "expenses.json");
}

function userRemindersPath(userId: string): string {
  return path.join(userDataDir(userId), "reminders.json");
}

function userPushSubscriptionsPath(userId: string): string {
  return path.join(userDataDir(userId), "push-subscriptions.json");
}

function userActivityPath(userId: string): string {
  return path.join(userDataDir(userId), "activity.json");
}

// ---- Config (per-user) ----

export function getConfig(userId: string): AppConfig {
  if (getPersistenceMode() === "SQLITE") return sqliteGetConfig(userId);

  const dir = userDataDir(userId);
  const configPath = userConfigPath(userId);
  ensureDir(dir);
  if (!fs.existsSync(configPath)) {
    const defaultConfig: AppConfig = {
      categories: [...DEFAULT_CATEGORIES],
      currency: "usd",
      startDate: 1,
      recurringExpenses: [],
    };
    fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 4));
    return defaultConfig;
  }
  const raw = fs.readFileSync(configPath, "utf-8");
  return JSON.parse(raw) as AppConfig;
}

export function saveConfig(userId: string, config: AppConfig) {
  if (getPersistenceMode() === "SQLITE")
    return sqliteSaveConfig(userId, config);

  const dir = userDataDir(userId);
  ensureDir(dir);
  fs.writeFileSync(userConfigPath(userId), JSON.stringify(config, null, 4));
}

// ---- Expenses (per-user) ----

export function getExpenses(userId: string): Expense[] {
  if (getPersistenceMode() === "SQLITE") return sqliteGetExpenses(userId);

  const dir = userDataDir(userId);
  const expPath = userExpensesPath(userId);
  ensureDir(dir);
  if (!fs.existsSync(expPath)) {
    const initial: ExpensesFile = { expenses: [] };
    fs.writeFileSync(expPath, JSON.stringify(initial, null, 4));
    return [];
  }
  const raw = fs.readFileSync(expPath, "utf-8");
  const data = JSON.parse(raw) as ExpensesFile;
  return data.expenses || [];
}

export function saveExpenses(userId: string, expenses: Expense[]) {
  if (getPersistenceMode() === "SQLITE")
    return sqliteSaveExpenses(userId, expenses);

  const dir = userDataDir(userId);
  ensureDir(dir);
  const data: ExpensesFile = { expenses };
  fs.writeFileSync(userExpensesPath(userId), JSON.stringify(data, null, 4));
}

// ---- Reminders (per-user) ----

export function getReminders(userId: string): Reminder[] {
  if (getPersistenceMode() === "SQLITE") return sqliteGetReminders(userId);

  const dir = userDataDir(userId);
  const remPath = userRemindersPath(userId);
  ensureDir(dir);
  if (!fs.existsSync(remPath)) {
    const initial: RemindersFile = { reminders: [] };
    fs.writeFileSync(remPath, JSON.stringify(initial, null, 4));
    return [];
  }
  const raw = fs.readFileSync(remPath, "utf-8");
  const data = JSON.parse(raw) as RemindersFile;
  return data.reminders || [];
}

export function saveReminders(userId: string, reminders: Reminder[]) {
  if (getPersistenceMode() === "SQLITE")
    return sqliteSaveReminders(userId, reminders);

  const dir = userDataDir(userId);
  ensureDir(dir);
  const data: RemindersFile = { reminders };
  fs.writeFileSync(userRemindersPath(userId), JSON.stringify(data, null, 4));
}

// ---- Web push subscriptions (per-user) ----

export function getPushSubscriptions(userId: string): WebPushSubscription[] {
  if (getPersistenceMode() === "SQLITE")
    return sqliteGetPushSubscriptions(userId);

  const dir = userDataDir(userId);
  const subsPath = userPushSubscriptionsPath(userId);
  ensureDir(dir);
  if (!fs.existsSync(subsPath)) {
    const initial: WebPushSubscriptionsFile = { subscriptions: [] };
    fs.writeFileSync(subsPath, JSON.stringify(initial, null, 4));
    return [];
  }
  const raw = fs.readFileSync(subsPath, "utf-8");
  const data = JSON.parse(raw) as WebPushSubscriptionsFile;
  return data.subscriptions || [];
}

export function savePushSubscriptions(
  userId: string,
  subscriptions: WebPushSubscription[]
) {
  if (getPersistenceMode() === "SQLITE")
    return sqliteSavePushSubscriptions(userId, subscriptions);

  const dir = userDataDir(userId);
  ensureDir(dir);
  const data: WebPushSubscriptionsFile = { subscriptions };
  fs.writeFileSync(
    userPushSubscriptionsPath(userId),
    JSON.stringify(data, null, 4)
  );
}

// ---- Activity Logs (per-user) ----

const MAX_ACTIVITY_LOGS = 500;

export function getActivityLogs(userId: string): ActivityLog[] {
  if (getPersistenceMode() === "SQLITE")
    return sqliteGetActivityLogs(userId);

  const dir = userDataDir(userId);
  const actPath = userActivityPath(userId);
  ensureDir(dir);
  if (!fs.existsSync(actPath)) {
    const initial: ActivityLogsFile = { logs: [] };
    fs.writeFileSync(actPath, JSON.stringify(initial, null, 4));
    return [];
  }
  const raw = fs.readFileSync(actPath, "utf-8");
  const data = JSON.parse(raw) as ActivityLogsFile;
  return data.logs || [];
}

export function appendActivityLog(userId: string, log: ActivityLog) {
  if (getPersistenceMode() === "SQLITE")
    return sqliteAppendActivityLog(userId, log);

  const logs = getActivityLogs(userId);
  logs.unshift(log);
  if (logs.length > MAX_ACTIVITY_LOGS) {
    logs.length = MAX_ACTIVITY_LOGS;
  }
  const dir = userDataDir(userId);
  ensureDir(dir);
  fs.writeFileSync(userActivityPath(userId), JSON.stringify({ logs }, null, 4));
}
