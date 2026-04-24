import { CURRENCY_BEHAVIORS } from "./types";

export function formatCurrency(amount: number, currency: string): string {
  const behavior = CURRENCY_BEHAVIORS[currency] || CURRENCY_BEHAVIORS.usd;
  const absAmount = Math.abs(amount);
  const formatted = new Intl.NumberFormat(behavior.locale, {
    minimumFractionDigits: behavior.showDecimals ? 2 : 0,
    maximumFractionDigits: behavior.showDecimals ? 2 : 0,
  }).format(absAmount);

  const space = behavior.spaceBeforeSymbol ? " " : "";
  const sign = amount < 0 ? "-" : "";
  if (behavior.position === "left") {
    return `${sign}${behavior.symbol}${space}${formatted}`;
  }
  return `${sign}${formatted}${space}${behavior.symbol}`;
}

export function getMonthBounds(date: Date, startDay: number): { start: Date; end: Date } {
  const year = date.getFullYear();
  const month = date.getMonth();

  let start: Date;
  let end: Date;

  if (date.getDate() >= startDay) {
    start = new Date(year, month, startDay);
    end = new Date(year, month + 1, startDay);
  } else {
    start = new Date(year, month - 1, startDay);
    end = new Date(year, month, startDay);
  }

  return { start, end };
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function toDateTimeLocal(date?: Date | string): string {
  const d = date ? new Date(date) : new Date();
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

export function formatMonth(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function sanitizeString(s: string): string {
  return s
    .replace(/[^\p{L}\p{N}\s.,\-'_!"]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}
