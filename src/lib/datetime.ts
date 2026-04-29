export type DateInput = string | Date | null | undefined;

const MS_PER_DAY = 1000 * 60 * 60 * 24;

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

export function parseDateInput(value: DateInput): Date | null {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function getDateInputTimeMs(value: DateInput): number | null {
  return parseDateInput(value)?.getTime() ?? null;
}

export function compareDateInputsAsc(left: DateInput, right: DateInput): number {
  const leftTime = getDateInputTimeMs(left);
  const rightTime = getDateInputTimeMs(right);

  if (leftTime === null || rightTime === null) {
    return 0;
  }

  return leftTime - rightTime;
}

export function getStartOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addLocalDays(date: Date, amount: number): Date {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + amount);
  return nextDate;
}

export function addHours(date: Date, amount: number): Date {
  const nextDate = new Date(date);
  nextDate.setHours(nextDate.getHours() + amount);
  return nextDate;
}

export function createLocalDateTime(baseDate: Date, hours: number, minutes: number): Date {
  return new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), hours, minutes);
}

export function isSameLocalDay(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

export function differenceInDays(later: Date, earlier: Date): number {
  return Math.floor((later.getTime() - earlier.getTime()) / MS_PER_DAY);
}

export function formatHourMinute(value: DateInput, locale?: string): string | null {
  const date = parseDateInput(value);
  if (date === null) {
    return null;
  }

  return date.toLocaleTimeString(locale, {
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

  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function formatShortDate(value: DateInput, locale?: string): string | null {
  const date = parseDateInput(value);
  if (date === null) {
    return null;
  }

  return date.toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
  });
}

export function formatMediumDate(value: DateInput, locale?: string): string | null {
  const date = parseDateInput(value);
  if (date === null) {
    return null;
  }

  return date.toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
