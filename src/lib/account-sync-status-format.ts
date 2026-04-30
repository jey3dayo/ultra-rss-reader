import {
  formatHourMinute,
  formatShortDate,
  formatShortDateTime,
  getCurrentDate,
  isSameLocalDay,
  parseDateInput,
} from "@/lib/datetime";

export function formatAccountSyncRetryTime(retryAt: string | undefined, language: string): string | null {
  return formatHourMinute(retryAt, language);
}

export function formatAccountSyncRetryDateTime(retryAt: string | undefined, language: string): string | null {
  return formatShortDateTime(retryAt, language);
}

export function formatAccountLastSuccessLabel(
  lastSuccessAt: string | undefined,
  language: string,
): {
  date: string;
  time: string;
  isToday: boolean;
} | null {
  const date = parseDateInput(lastSuccessAt);
  if (date === null) {
    return null;
  }

  return {
    date: formatShortDate(date, language) ?? "",
    time: formatHourMinute(date, language) ?? "",
    isToday: isSameLocalDay(date, getCurrentDate()),
  };
}
