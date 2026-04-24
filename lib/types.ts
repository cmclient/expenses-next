export interface User {
  id: string;
  username: string;
  password: string; // bcrypt hash
  isAdmin: boolean;
  avatar?: string; // icon name e.g. "solar:cat-bold-duotone"
  createdAt: string;
  updatedAt: string;
}

export interface UsersFile {
  users: User[];
}

export interface Expense {
  id: string;
  recurringID: string;
  name: string;
  tags: string[];
  category: string;
  amount: number; // negative = expense, positive = income
  currency: string;
  date: string; // ISO 8601 / RFC 3339
}

export interface RecurringExpense {
  id: string;
  name: string;
  amount: number;
  currency: string;
  tags: string[];
  category: string;
  startDate: string;
  interval: "daily" | "weekly" | "monthly" | "yearly";
  occurrences: number; // min 2, 0 = indefinite (3000)
}

export interface ReminderAlertConfig {
  browser: boolean;
  email: boolean;
  emailAddress?: string;
  discord: boolean;
  discordWebhookUrl?: string;
  discordUsername?: string;
  discordAvatarUrl?: string;
}

export interface Reminder {
  id: string;
  name: string;
  payer: string;
  category: string;
  amount: number;
  currency: string;
  intervalAmount: number
  intervalType: "daily" | "weekly" | "monthly" | "yearly";
  startDate: string; // ISO 8601
  nextDueDate: string; // ISO 8601 - next payment due
  alerts: ReminderAlertConfig;
  paid: boolean;
  paidAt?: string; // ISO 8601
  lastAlertSentAt?: string; // ISO 8601
  createdAt: string;
}

export interface RemindersFile {
  reminders: Reminder[];
}

export interface WebPushSubscription {
  endpoint: string;
  expirationTime: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
  createdAt: string;
}

export interface WebPushSubscriptionsFile {
  subscriptions: WebPushSubscription[];
}

export interface AppConfig {
  categories: string[];
  currency: string;
  startDate: number;
  recurringExpenses: RecurringExpense[];
}

export interface ExpensesFile {
  expenses: Expense[];
}

// ---- Constants ----

export const DEFAULT_CATEGORIES = [
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
];

export const SUPPORTED_CURRENCIES = [
  "usd", "eur", "gbp", "jpy", "cny", "krw", "inr", "rub", "brl", "zar",
  "aed", "aud", "cad", "chf", "hkd", "bdt", "sgd", "thb", "try", "mxn",
  "php", "pln", "sek", "nzd", "dkk", "idr", "ils", "vnd", "myr", "mad",
];

export const CURRENCY_LABELS: Record<string, string> = {
  usd: "US Dollar ($)",
  eur: "Euro (€)",
  gbp: "British Pound (£)",
  jpy: "Japanese Yen (¥)",
  cny: "Chinese Yuan (¥)",
  krw: "Korean Won (₩)",
  inr: "Indian Rupee (₹)",
  rub: "Russian Ruble (₽)",
  brl: "Brazilian Real (R$)",
  zar: "South African Rand (R)",
  aed: "UAE Dirham (د.إ)",
  aud: "Australian Dollar (A$)",
  cad: "Canadian Dollar (C$)",
  chf: "Swiss Franc (CHF)",
  hkd: "Hong Kong Dollar (HK$)",
  bdt: "Bangladeshi Taka (৳)",
  sgd: "Singapore Dollar (S$)",
  thb: "Thai Baht (฿)",
  try: "Turkish Lira (₺)",
  mxn: "Mexican Peso (MX$)",
  php: "Philippine Peso (₱)",
  pln: "Polish Złoty (zł)",
  sek: "Swedish Krona (kr)",
  nzd: "New Zealand Dollar (NZ$)",
  dkk: "Danish Krone (kr)",
  idr: "Indonesian Rupiah (Rp)",
  ils: "Israeli Shekel (₪)",
  vnd: "Vietnamese Dong (₫)",
  myr: "Malaysian Ringgit (RM)",
  mad: "Moroccan Dirham (MAD)",
};

export interface CurrencyBehavior {
  symbol: string;
  position: "left" | "right";
  locale: string;
  showDecimals: boolean;
  spaceBeforeSymbol: boolean;
}

export const CURRENCY_BEHAVIORS: Record<string, CurrencyBehavior> = {
  usd: { symbol: "$", position: "left", locale: "en-US", showDecimals: true, spaceBeforeSymbol: false },
  eur: { symbol: "€", position: "right", locale: "de-DE", showDecimals: true, spaceBeforeSymbol: true },
  gbp: { symbol: "£", position: "left", locale: "en-GB", showDecimals: true, spaceBeforeSymbol: false },
  jpy: { symbol: "¥", position: "left", locale: "ja-JP", showDecimals: false, spaceBeforeSymbol: false },
  cny: { symbol: "¥", position: "left", locale: "zh-CN", showDecimals: true, spaceBeforeSymbol: false },
  krw: { symbol: "₩", position: "left", locale: "ko-KR", showDecimals: false, spaceBeforeSymbol: false },
  inr: { symbol: "₹", position: "left", locale: "en-IN", showDecimals: true, spaceBeforeSymbol: false },
  rub: { symbol: "₽", position: "right", locale: "ru-RU", showDecimals: true, spaceBeforeSymbol: true },
  brl: { symbol: "R$", position: "left", locale: "pt-BR", showDecimals: true, spaceBeforeSymbol: true },
  zar: { symbol: "R", position: "left", locale: "en-ZA", showDecimals: true, spaceBeforeSymbol: false },
  aed: { symbol: "د.إ", position: "right", locale: "ar-AE", showDecimals: true, spaceBeforeSymbol: true },
  aud: { symbol: "A$", position: "left", locale: "en-AU", showDecimals: true, spaceBeforeSymbol: false },
  cad: { symbol: "C$", position: "left", locale: "en-CA", showDecimals: true, spaceBeforeSymbol: false },
  chf: { symbol: "CHF", position: "right", locale: "de-CH", showDecimals: true, spaceBeforeSymbol: true },
  hkd: { symbol: "HK$", position: "left", locale: "en-HK", showDecimals: true, spaceBeforeSymbol: false },
  bdt: { symbol: "৳", position: "left", locale: "bn-BD", showDecimals: true, spaceBeforeSymbol: false },
  sgd: { symbol: "S$", position: "left", locale: "en-SG", showDecimals: true, spaceBeforeSymbol: false },
  thb: { symbol: "฿", position: "left", locale: "th-TH", showDecimals: true, spaceBeforeSymbol: false },
  try: { symbol: "₺", position: "left", locale: "tr-TR", showDecimals: true, spaceBeforeSymbol: false },
  mxn: { symbol: "MX$", position: "left", locale: "es-MX", showDecimals: true, spaceBeforeSymbol: false },
  php: { symbol: "₱", position: "left", locale: "en-PH", showDecimals: true, spaceBeforeSymbol: false },
  pln: { symbol: "zł", position: "right", locale: "pl-PL", showDecimals: true, spaceBeforeSymbol: true },
  sek: { symbol: "kr", position: "right", locale: "sv-SE", showDecimals: true, spaceBeforeSymbol: true },
  nzd: { symbol: "NZ$", position: "left", locale: "en-NZ", showDecimals: true, spaceBeforeSymbol: false },
  dkk: { symbol: "kr", position: "right", locale: "da-DK", showDecimals: true, spaceBeforeSymbol: true },
  idr: { symbol: "Rp", position: "left", locale: "id-ID", showDecimals: false, spaceBeforeSymbol: false },
  ils: { symbol: "₪", position: "left", locale: "he-IL", showDecimals: true, spaceBeforeSymbol: true },
  vnd: { symbol: "₫", position: "right", locale: "vi-VN", showDecimals: false, spaceBeforeSymbol: true },
  myr: { symbol: "RM", position: "left", locale: "ms-MY", showDecimals: true, spaceBeforeSymbol: false },
  mad: { symbol: "MAD", position: "right", locale: "ar-MA", showDecimals: true, spaceBeforeSymbol: true },
};

export const COLOR_PALETTE = [
  "#FF6384", "#36A2EB", "#FFCE56", "#4BC0C0",
  "#9966FF", "#FF9F40", "#E7E9ED", "#76D7C4",
  "#F7DC6F", "#85C1E9", "#F1948A", "#82E0AA",
];

export const VALID_INTERVALS = ["daily", "weekly", "monthly", "yearly"] as const;
