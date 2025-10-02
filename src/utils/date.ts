/**
 * Date and time manipulation utilities.
 *
 * This module provides utilities for date parsing, formatting, manipulation,
 * and timezone operations.
 *
 * @module utils/date
 */

/**
 * Time units for duration calculations.
 */
export enum TimeUnit {
  MILLISECOND = 1,
  SECOND = 1000,
  MINUTE = 60 * 1000,
  HOUR = 60 * 60 * 1000,
  DAY = 24 * 60 * 60 * 1000,
  WEEK = 7 * 24 * 60 * 60 * 1000
}

/**
 * Parse a date from various input formats.
 *
 * @param input - Date string, timestamp, or Date object
 * @returns Date object or null if invalid
 *
 * @example
 * ```typescript
 * parseDate('2024-01-01'); // Date object
 * parseDate(1704067200000); // Date from timestamp
 * parseDate(new Date()); // Returns same date
 * ```
 */
export function parseDate(input: string | number | Date): Date | null {
  if (input instanceof Date) {
    return isNaN(input.getTime()) ? null : input;
  }

  if (typeof input === 'number') {
    const date = new Date(input);
    return isNaN(date.getTime()) ? null : date;
  }

  if (typeof input === 'string') {
    const date = new Date(input);
    return isNaN(date.getTime()) ? null : date;
  }

  return null;
}

/**
 * Format a date using a simple format string.
 *
 * Format tokens:
 * - YYYY: 4-digit year
 * - MM: 2-digit month
 * - DD: 2-digit day
 * - HH: 2-digit hour (24-hour)
 * - mm: 2-digit minute
 * - ss: 2-digit second
 * - SSS: 3-digit millisecond
 *
 * @param date - Date to format
 * @param format - Format string
 * @returns Formatted date string
 *
 * @example
 * ```typescript
 * formatDate(new Date(), 'YYYY-MM-DD'); // '2024-01-01'
 * formatDate(new Date(), 'YYYY-MM-DD HH:mm:ss'); // '2024-01-01 15:30:45'
 * ```
 */
export function formatDate(date: Date, format: string): string {
  const pad = (n: number, length = 2) => String(n).padStart(length, '0');

  const tokens: Record<string, string> = {
    YYYY: String(date.getFullYear()),
    MM: pad(date.getMonth() + 1),
    DD: pad(date.getDate()),
    HH: pad(date.getHours()),
    mm: pad(date.getMinutes()),
    ss: pad(date.getSeconds()),
    SSS: pad(date.getMilliseconds(), 3)
  };

  let result = format;
  for (const [token, value] of Object.entries(tokens)) {
    result = result.replace(token, value);
  }

  return result;
}

/**
 * Get relative time string (e.g., "2 hours ago", "in 3 days").
 *
 * @param date - Date to compare
 * @param now - Reference date (default: current time)
 * @returns Relative time string
 *
 * @example
 * ```typescript
 * formatRelative(new Date(Date.now() - 3600000)); // '1 hour ago'
 * formatRelative(new Date(Date.now() + 86400000)); // 'in 1 day'
 * ```
 */
export function formatRelative(date: Date, now = new Date()): string {
  const diff = date.getTime() - now.getTime();
  const absDiff = Math.abs(diff);

  const units: [number, string, string][] = [
    [TimeUnit.WEEK, 'week', 'weeks'],
    [TimeUnit.DAY, 'day', 'days'],
    [TimeUnit.HOUR, 'hour', 'hours'],
    [TimeUnit.MINUTE, 'minute', 'minutes'],
    [TimeUnit.SECOND, 'second', 'seconds']
  ];

  for (const [unit, singular, plural] of units) {
    if (absDiff >= unit) {
      const value = Math.floor(absDiff / unit);
      const label = value === 1 ? singular : plural;
      return diff < 0 ? `${value} ${label} ago` : `in ${value} ${label}`;
    }
  }

  return 'just now';
}

/**
 * Add time to a date.
 *
 * @param date - Base date
 * @param amount - Amount to add
 * @param unit - Time unit
 * @returns New date with time added
 *
 * @example
 * ```typescript
 * addTime(new Date(), 7, TimeUnit.DAY); // Date 7 days from now
 * addTime(new Date(), 30, TimeUnit.MINUTE); // Date 30 minutes from now
 * ```
 */
export function addTime(date: Date, amount: number, unit: TimeUnit): Date {
  return new Date(date.getTime() + amount * unit);
}

/**
 * Subtract time from a date.
 *
 * @param date - Base date
 * @param amount - Amount to subtract
 * @param unit - Time unit
 * @returns New date with time subtracted
 *
 * @example
 * ```typescript
 * subtractTime(new Date(), 1, TimeUnit.DAY); // Date yesterday
 * ```
 */
export function subtractTime(date: Date, amount: number, unit: TimeUnit): Date {
  return new Date(date.getTime() - amount * unit);
}

/**
 * Get the difference between two dates.
 *
 * @param date1 - First date
 * @param date2 - Second date
 * @param unit - Time unit for result (default: milliseconds)
 * @returns Difference in specified unit
 *
 * @example
 * ```typescript
 * const diff = dateDiff(date1, date2, TimeUnit.DAY);
 * console.log(`${diff} days difference`);
 * ```
 */
export function dateDiff(date1: Date, date2: Date, unit: TimeUnit = TimeUnit.MILLISECOND): number {
  return Math.abs(date1.getTime() - date2.getTime()) / unit;
}

/**
 * Check if a date is in the past.
 *
 * @param date - Date to check
 * @param now - Reference date (default: current time)
 * @returns True if date is in the past
 *
 * @example
 * ```typescript
 * if (isPast(expiryDate)) {
 *   console.log('Token has expired');
 * }
 * ```
 */
export function isPast(date: Date, now = new Date()): boolean {
  return date.getTime() < now.getTime();
}

/**
 * Check if a date is in the future.
 *
 * @param date - Date to check
 * @param now - Reference date (default: current time)
 * @returns True if date is in the future
 *
 * @example
 * ```typescript
 * if (isFuture(scheduledDate)) {
 *   console.log('Event is upcoming');
 * }
 * ```
 */
export function isFuture(date: Date, now = new Date()): boolean {
  return date.getTime() > now.getTime();
}

/**
 * Check if a date is today.
 *
 * @param date - Date to check
 * @param now - Reference date (default: current time)
 * @returns True if date is today
 *
 * @example
 * ```typescript
 * if (isToday(messageDate)) {
 *   console.log('Message sent today');
 * }
 * ```
 */
export function isToday(date: Date, now = new Date()): boolean {
  return isSameDay(date, now);
}

/**
 * Check if two dates are on the same day.
 *
 * @param date1 - First date
 * @param date2 - Second date
 * @returns True if dates are on the same day
 *
 * @example
 * ```typescript
 * if (isSameDay(date1, date2)) {
 *   console.log('Same day');
 * }
 * ```
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

/**
 * Check if a date is within a date range.
 *
 * @param date - Date to check
 * @param start - Range start date
 * @param end - Range end date
 * @param inclusive - Include boundaries (default: true)
 * @returns True if date is within range
 *
 * @example
 * ```typescript
 * if (isWithinRange(eventDate, startDate, endDate)) {
 *   console.log('Event is in range');
 * }
 * ```
 */
export function isWithinRange(
  date: Date,
  start: Date,
  end: Date,
  inclusive = true
): boolean {
  const time = date.getTime();
  const startTime = start.getTime();
  const endTime = end.getTime();

  if (inclusive) {
    return time >= startTime && time <= endTime;
  } else {
    return time > startTime && time < endTime;
  }
}

/**
 * Get the start of day (00:00:00.000).
 *
 * @param date - Date to process
 * @returns New date at start of day
 *
 * @example
 * ```typescript
 * const dayStart = startOfDay(new Date());
 * // Returns date with time set to 00:00:00.000
 * ```
 */
export function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

/**
 * Get the end of day (23:59:59.999).
 *
 * @param date - Date to process
 * @returns New date at end of day
 *
 * @example
 * ```typescript
 * const dayEnd = endOfDay(new Date());
 * // Returns date with time set to 23:59:59.999
 * ```
 */
export function endOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

/**
 * Get the start of month (first day at 00:00:00.000).
 *
 * @param date - Date to process
 * @returns New date at start of month
 *
 * @example
 * ```typescript
 * const monthStart = startOfMonth(new Date());
 * ```
 */
export function startOfMonth(date: Date): Date {
  const result = new Date(date);
  result.setDate(1);
  result.setHours(0, 0, 0, 0);
  return result;
}

/**
 * Get the end of month (last day at 23:59:59.999).
 *
 * @param date - Date to process
 * @returns New date at end of month
 *
 * @example
 * ```typescript
 * const monthEnd = endOfMonth(new Date());
 * ```
 */
export function endOfMonth(date: Date): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + 1, 0);
  result.setHours(23, 59, 59, 999);
  return result;
}

/**
 * Get the number of days in a month.
 *
 * @param date - Date in the month
 * @returns Number of days in month
 *
 * @example
 * ```typescript
 * const days = daysInMonth(new Date(2024, 1)); // 29 (leap year)
 * ```
 */
export function daysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

/**
 * Check if a year is a leap year.
 *
 * @param year - Year to check
 * @returns True if leap year
 *
 * @example
 * ```typescript
 * isLeapYear(2024); // true
 * isLeapYear(2023); // false
 * ```
 */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Get the day of week (0 = Sunday, 6 = Saturday).
 *
 * @param date - Date to check
 * @returns Day of week (0-6)
 */
export function getDayOfWeek(date: Date): number {
  return date.getDay();
}

/**
 * Get the week number of the year (ISO 8601).
 *
 * @param date - Date to check
 * @returns Week number (1-53)
 *
 * @example
 * ```typescript
 * const week = getWeekNumber(new Date());
 * console.log(`Week ${week} of the year`);
 * ```
 */
export function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/**
 * Check if a date is a weekend (Saturday or Sunday).
 *
 * @param date - Date to check
 * @returns True if weekend
 *
 * @example
 * ```typescript
 * if (isWeekend(new Date())) {
 *   console.log("It's the weekend!");
 * }
 * ```
 */
export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/**
 * Format a duration in milliseconds to human-readable string.
 *
 * @param ms - Duration in milliseconds
 * @param detailed - Include all units or only largest (default: false)
 * @returns Formatted duration string
 *
 * @example
 * ```typescript
 * formatDuration(90000); // '1 minute'
 * formatDuration(90000, true); // '1 minute 30 seconds'
 * formatDuration(3665000); // '1 hour'
 * formatDuration(3665000, true); // '1 hour 1 minute 5 seconds'
 * ```
 */
export function formatDuration(ms: number, detailed = false): string {
  const units: [number, string, string][] = [
    [TimeUnit.WEEK, 'week', 'weeks'],
    [TimeUnit.DAY, 'day', 'days'],
    [TimeUnit.HOUR, 'hour', 'hours'],
    [TimeUnit.MINUTE, 'minute', 'minutes'],
    [TimeUnit.SECOND, 'second', 'seconds']
  ];

  if (ms < TimeUnit.SECOND) {
    return `${ms} milliseconds`;
  }

  const parts: string[] = [];
  let remaining = ms;

  for (const [unitMs, singular, plural] of units) {
    if (remaining >= unitMs) {
      const value = Math.floor(remaining / unitMs);
      parts.push(`${value} ${value === 1 ? singular : plural}`);
      remaining %= unitMs;

      if (!detailed && parts.length > 0) {
        break;
      }
    }
  }

  return parts.join(' ') || '0 seconds';
}

/**
 * Parse duration string to milliseconds.
 *
 * @param duration - Duration string (e.g., '2h', '30m', '1d')
 * @returns Duration in milliseconds
 *
 * @example
 * ```typescript
 * parseDuration('2h'); // 7200000
 * parseDuration('30m'); // 1800000
 * parseDuration('1d'); // 86400000
 * ```
 */
export function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)(ms|s|m|h|d|w)$/);
  if (!match) {
    throw new Error(`Invalid duration format: ${duration}`);
  }

  const [, amount, unit] = match;
  const value = parseInt(amount, 10);

  const units: Record<string, number> = {
    ms: TimeUnit.MILLISECOND,
    s: TimeUnit.SECOND,
    m: TimeUnit.MINUTE,
    h: TimeUnit.HOUR,
    d: TimeUnit.DAY,
    w: TimeUnit.WEEK
  };

  return value * units[unit];
}

/**
 * Get Unix timestamp in seconds.
 *
 * @param date - Date to convert (default: current time)
 * @returns Unix timestamp in seconds
 *
 * @example
 * ```typescript
 * const timestamp = getUnixTimestamp();
 * const timestamp = getUnixTimestamp(new Date('2024-01-01'));
 * ```
 */
export function getUnixTimestamp(date = new Date()): number {
  return Math.floor(date.getTime() / 1000);
}

/**
 * Create date from Unix timestamp.
 *
 * @param timestamp - Unix timestamp in seconds
 * @returns Date object
 *
 * @example
 * ```typescript
 * const date = fromUnixTimestamp(1704067200);
 * ```
 */
export function fromUnixTimestamp(timestamp: number): Date {
  return new Date(timestamp * 1000);
}

/**
 * Get age from birth date.
 *
 * @param birthDate - Birth date
 * @param now - Reference date (default: current time)
 * @returns Age in years
 *
 * @example
 * ```typescript
 * const age = getAge(new Date('1990-01-01'));
 * ```
 */
export function getAge(birthDate: Date, now = new Date()): number {
  let age = now.getFullYear() - birthDate.getFullYear();
  const monthDiff = now.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthDate.getDate())) {
    age--;
  }

  return age;
}

/**
 * Clone a date object.
 *
 * @param date - Date to clone
 * @returns New date instance with same time
 *
 * @example
 * ```typescript
 * const clone = cloneDate(originalDate);
 * ```
 */
export function cloneDate(date: Date): Date {
  return new Date(date.getTime());
}

/**
 * Get ISO 8601 string (with timezone).
 *
 * @param date - Date to convert
 * @returns ISO 8601 string
 *
 * @example
 * ```typescript
 * const iso = toISO(new Date());
 * // '2024-01-01T12:00:00.000Z'
 * ```
 */
export function toISO(date: Date): string {
  return date.toISOString();
}

/**
 * Sleep for a duration.
 *
 * @param ms - Duration in milliseconds
 * @returns Promise that resolves after duration
 *
 * @example
 * ```typescript
 * await sleep(1000); // Sleep for 1 second
 * ```
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
