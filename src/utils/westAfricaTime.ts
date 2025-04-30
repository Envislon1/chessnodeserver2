
import { formatInTimeZone } from "date-fns-tz";

/**
 * Formats a JS Date or timestamp as a string in West Africa Time.
 * @param date Input date (Date or ms timestamp)
 * @param formatStr Output format (default: "yyyy-MM-dd HH:mm:ss")
 * @returns Formatted string in "Africa/Lagos" TZ
 */
export function formatWestAfricaTime(
  date: Date | number,
  formatStr: string = "yyyy-MM-dd HH:mm:ss"
) {
  return formatInTimeZone(date, "Africa/Lagos", formatStr);
}

/**
 * Returns a "time ago" text in West Africa Time (optionally).
 */
export function timeAgo(targetMs: number): string {
  const now = Date.now();
  const seconds = Math.floor((now - targetMs) / 1000);

  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
