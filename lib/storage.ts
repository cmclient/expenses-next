import fs from "fs";
import path from "path";
import {
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

// Data directory - configurable via env, defaults to ./data
const DATA_DIR = process.env.STORAGE_URL || path.join(process.cwd(), "data");
const USERS_PATH = path.join(DATA_DIR, "users.json");

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// ---- Users ----

export function getUsers(): User[] {
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
  ensureDir(DATA_DIR);
  fs.writeFileSync(USERS_PATH, JSON.stringify({ users }, null, 4));
}

export function getUserByUsername(username: string): User | undefined {
  return getUsers().find((u) => u.username === username);
}

export function getUserById(id: string): User | undefined {
  return getUsers().find((u) => u.id === id);
}

// ---- Per-user data directories ----

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

// ---- Config (per-user) ----

export function getConfig(userId: string): AppConfig {
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
  const dir = userDataDir(userId);
  ensureDir(dir);
  fs.writeFileSync(userConfigPath(userId), JSON.stringify(config, null, 4));
}

// ---- Expenses (per-user) ----

export function getExpenses(userId: string): Expense[] {
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
  const dir = userDataDir(userId);
  ensureDir(dir);
  const data: ExpensesFile = { expenses };
  fs.writeFileSync(userExpensesPath(userId), JSON.stringify(data, null, 4));
}

// ---- Reminders (per-user) ----

export function getReminders(userId: string): Reminder[] {
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
  const dir = userDataDir(userId);
  ensureDir(dir);
  const data: RemindersFile = { reminders };
  fs.writeFileSync(userRemindersPath(userId), JSON.stringify(data, null, 4));
}

// ---- Web push subscriptions (per-user) ----

export function getPushSubscriptions(userId: string): WebPushSubscription[] {
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

export function savePushSubscriptions(userId: string, subscriptions: WebPushSubscription[]) {
  const dir = userDataDir(userId);
  ensureDir(dir);
  const data: WebPushSubscriptionsFile = { subscriptions };
  fs.writeFileSync(userPushSubscriptionsPath(userId), JSON.stringify(data, null, 4));
}
