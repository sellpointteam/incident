/**
 * Single source of truth for date parsing/formatting in the app.
 *
 * Rules:
 * - All incident/KIA dates in the DB are stored as `YYYY-MM-DD` strings (no time).
 * - We treat them as **calendar dates**, not timestamps. Parsing them with `new Date(s)`
 *   yields UTC midnight which then renders as the *previous day* in PKT/IST. That is the
 *   off-by-one bug we are eliminating here.
 * - All sorts use `.getTime()` on a Date produced by `parseIncidentDate`.
 * - For `created_at` / timestamps with timezone, use `parseTimestamp` instead.
 */
import { format, parseISO, isValid } from "date-fns";

/**
 * Parse a `YYYY-MM-DD` calendar date string as a local-midnight Date.
 * Falsy input returns null. Invalid input returns null.
 */
export function parseIncidentDate(input: string | null | undefined): Date | null {
  if (!input) return null;
  // Accept either YYYY-MM-DD or full ISO; strip time if present
  const dateOnly = input.length >= 10 ? input.slice(0, 10) : input;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOnly);
  if (!m) return null;
  const [, y, mo, d] = m;
  const date = new Date(Number(y), Number(mo) - 1, Number(d));
  return isValid(date) ? date : null;
}

/** Like parseIncidentDate but throws if input is invalid — use only when you know it's valid. */
export function parseIncidentDateStrict(input: string): Date {
  const d = parseIncidentDate(input);
  if (!d) throw new Error(`Invalid incident date: ${input}`);
  return d;
}

/** Parse a full ISO 8601 timestamp (e.g. created_at, posted_at). */
export function parseTimestamp(input: string | null | undefined): Date | null {
  if (!input) return null;
  const d = parseISO(input);
  return isValid(d) ? d : null;
}

/** Format an incident date. Returns the fallback if input is invalid. */
export function formatIncidentDate(
  input: string | Date | null | undefined,
  fmt: string = "dd MMM yyyy",
  fallback: string = "—",
): string {
  const date = input instanceof Date ? input : parseIncidentDate(input ?? null);
  if (!date) return fallback;
  return format(date, fmt);
}

/** Format a timestamp. Returns the fallback if input is invalid. */
export function formatTimestamp(
  input: string | Date | null | undefined,
  fmt: string = "PPp",
  fallback: string = "—",
): string {
  const date = input instanceof Date ? input : parseTimestamp(input ?? null);
  if (!date) return fallback;
  return format(date, fmt);
}

/** Today as a `YYYY-MM-DD` string in the user's local timezone. */
export function todayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Compare two incident date strings; safe for sort callbacks. */
export function compareIncidentDates(a: string, b: string): number {
  const da = parseIncidentDate(a)?.getTime() ?? 0;
  const db = parseIncidentDate(b)?.getTime() ?? 0;
  return da - db;
}
