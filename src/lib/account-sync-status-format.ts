import { formatHourMinute, getCurrentDate, isSameLocalDay, parseDateInput } from "@/lib/datetime";

export function formatAccountSyncRetryTime(retryAt: string | undefined, language: string): string | null {
  return formatHourMinute(retryAt, language);
}

export function formatAccountSyncRetryDateTime(retryAt: string | undefined, language: string): string | null {
  const date = parseDateInput(retryAt);
  if (date === null) {
    return null;
  }

  return date.toLocaleString(language, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
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
    date: date.toLocaleDateString(language, { month: "short", day: "numeric" }),
    time: formatHourMinute(date, language) ?? "",
    isToday: isSameLocalDay(date, getCurrentDate()),
  };
}
