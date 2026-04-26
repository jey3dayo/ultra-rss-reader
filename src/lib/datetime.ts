export type DateInput = string | null | undefined;

export function getCurrentDate(): Date {
  return new Date();
}

export function getCurrentTimeMs(): number {
  return Date.now();
}

export function formatDebugTimestamp(date: Date = getCurrentDate()): string {
  return date.toISOString().slice(11, 23);
}

function parseDateInput(value: DateInput): Date | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
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
