import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

const USD_INT_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const USD_DEC_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const USD_EXACT_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const SLUG_NON_ALNUM_RE = /[^a-z0-9]+/g;
const SLUG_TRIM_DASH_RE = /^-+|-+$/g;

export const usd = (value: number): string =>
  (value % 1 === 0 ? USD_INT_FORMATTER : USD_DEC_FORMATTER).format(value);

export const usdExact = (value: number): string =>
  USD_EXACT_FORMATTER.format(value);

export const formatDate = (iso: string): string => {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return DATE_FORMATTER.format(date);
};

export const formatDateTime = (iso: string): string => {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return DATE_TIME_FORMATTER.format(date);
};

export const slugify = (text: string): string =>
  text
    .toLowerCase()
    .trim()
    .replace(SLUG_NON_ALNUM_RE, "-")
    .replace(SLUG_TRIM_DASH_RE, "");

export const newId = (): string => {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 11);
};

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
