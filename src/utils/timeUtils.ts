
import { formatInTimeZone } from 'date-fns-tz';

/**
 * Formats a date in a specific timezone
 * @param date The date to format
 * @param formatStr Format string
 * @param timeZone Timezone string (e.g., 'America/New_York')
 * @returns Formatted date string
 */
export const formatInTimezone = (
  date: Date | number,
  formatStr: string,
  timeZone: string
): string => {
  return formatInTimeZone(date, timeZone, formatStr);
};

/**
 * Gets a user-friendly difference between two times
 * @param timeDiffMs Time difference in milliseconds
 * @returns Formatted string describing the difference
 */
export function getTimeDifferenceText(timeDiffMs: number): string {
  const diffMinutes = Math.abs(Math.round(timeDiffMs / 60000));
  
  if (diffMinutes < 1) return "Your time is in sync with the server";
  
  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;
  
  let diffText = "Your time is ";
  diffText += timeDiffMs > 0 ? "behind" : "ahead of";
  diffText += " server time by ";
  
  if (hours > 0) {
    diffText += `${hours} hour${hours !== 1 ? 's' : ''}`;
    if (minutes > 0) diffText += ` and ${minutes} minute${minutes !== 1 ? 's' : ''}`;
  } else {
    diffText += `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  }
  
  return diffText;
}

/**
 * Format a time string in HH:MM format
 * @param date Date to format
 * @returns String in HH:MM format
 */
export function getHHMMFormat(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Format time in HH:MM format in UTC
 * @param date Date to format
 * @returns String in HH:MM format in UTC
 */
export function getUTCHHMMFormat(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}
