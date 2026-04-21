function parseAccountSyncDateTime(value: string | undefined): Date | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatAccountSyncRetryTime(retryAt: string | undefined, language: string): string | null {
  const date = parseAccountSyncDateTime(retryAt);
  if (date === null) {
    return null;
  }

  return date.toLocaleTimeString(language, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function formatAccountSyncRetryDateTime(retryAt: string | undefined, language: string): string | null {
  const date = parseAccountSyncDateTime(retryAt);
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
  const date = parseAccountSyncDateTime(lastSuccessAt);
  if (date === null) {
    return null;
  }

  const now = new Date();
  const isToday =
    date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();

  return {
    date: date.toLocaleDateString(language, { month: "short", day: "numeric" }),
    time: date.toLocaleTimeString(language, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }),
    isToday,
  };
}
