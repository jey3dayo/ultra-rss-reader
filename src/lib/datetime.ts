import { Result } from "@praha/byethrow";
import {
  addHours as addDateFnsHours,
  addDays,
  compareAsc,
  differenceInDays as differenceInDateFnsDays,
  format,
  getTime,
  isSameDay,
  isValid,
  set,
  startOfDay,
} from "date-fns";

export type DateInput = string | Date | null | undefined;
export type ParseDateInputError = "missing_value" | "invalid_date";

export function getCurrentDate(): Date {
  return new Date();
}

export function getCurrentTimeMs(): number {
  return Date.now();
}

export function getCurrentIsoTimestamp(): string {
  return getCurrentDate().toISOString();
}

export function toIsoTimestamp(date: Date): string {
  return date.toISOString();
}

export function formatDebugTimestamp(date: Date = getCurrentDate()): string {
  return date.toISOString().slice(11, 23);
}

export function parseDateInputResult(value: DateInput): Result.Result<Date, ParseDateInputError> {
  if (!value) {
    return Result.fail("missing_value");
  }

  if (value instanceof Date) {
    return isValid(value) ? Result.succeed(value) : Result.fail("invalid_date");
  }

  const date = new Date(value);
  return isValid(date) ? Result.succeed(date) : Result.fail("invalid_date");
}

export function parseDateInput(value: DateInput): Date | null {
  const parsed = parseDateInputResult(value);
  return Result.isSuccess(parsed) ? Result.unwrap(parsed) : null;
}

export function getDateInputTimeMs(value: DateInput): number | null {
  const date = parseDateInput(value);
  return date === null ? null : getTime(date);
}

export function compareDateInputsAsc(left: DateInput, right: DateInput): number {
  const leftTime = getDateInputTimeMs(left);
  const rightTime = getDateInputTimeMs(right);

  if (leftTime === null || rightTime === null) {
    return 0;
  }

  return compareAsc(leftTime, rightTime);
}

export function getStartOfLocalDay(date: Date): Date {
  return startOfDay(date);
}

export function addLocalDays(date: Date, amount: number): Date {
  return addDays(date, amount);
}

export function addHours(date: Date, amount: number): Date {
  return addDateFnsHours(date, amount);
}

export function createLocalDateTime(baseDate: Date, hours: number, minutes: number): Date {
  return set(baseDate, { hours, minutes, seconds: 0, milliseconds: 0 });
}

export function isSameLocalDay(left: Date, right: Date): boolean {
  return isSameDay(left, right);
}

export function differenceInDays(later: Date, earlier: Date): number {
  return differenceInDateFnsDays(later, earlier);
}

function resolveDateTimeLocale(locale?: string): string | undefined {
  if (locale === undefined) {
    return undefined;
  }

  try {
    const [supportedLocale] = Intl.DateTimeFormat.supportedLocalesOf(locale);
    return supportedLocale;
  } catch {
    return undefined;
  }
}

export function formatHourMinute(value: DateInput, locale?: string): string | null {
  const date = parseDateInput(value);
  if (date === null) {
    return null;
  }

  return date.toLocaleTimeString(resolveDateTimeLocale(locale), {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function formatLocalHourMinute(value: DateInput): string | null {
  const date = parseDateInput(value);
  if (date === null) {
    return null;
  }

  return format(date, "HH:mm");
}

export function formatShortDate(value: DateInput, locale?: string): string | null {
  const date = parseDateInput(value);
  if (date === null) {
    return null;
  }

  return date.toLocaleDateString(resolveDateTimeLocale(locale), {
    month: "short",
    day: "numeric",
  });
}

export function formatShortDateTime(value: DateInput, locale?: string): string | null {
  const date = parseDateInput(value);
  if (date === null) {
    return null;
  }

  return date.toLocaleString(resolveDateTimeLocale(locale), {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function formatLongDate(value: DateInput, locale?: string): string | null {
  const date = parseDateInput(value);
  if (date === null) {
    return null;
  }

  return date.toLocaleDateString(resolveDateTimeLocale(locale), {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatMediumDate(value: DateInput, locale?: string): string | null {
  const date = parseDateInput(value);
  if (date === null) {
    return null;
  }

  return date.toLocaleDateString(resolveDateTimeLocale(locale), {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatMediumDateOrDash(value: DateInput, locale?: string): string {
  return formatMediumDate(value, locale) ?? "—";
}
