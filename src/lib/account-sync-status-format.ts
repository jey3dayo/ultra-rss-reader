export function formatAccountSyncRetryTime(retryAt: string | undefined, language: string): string | null {
  if (!retryAt) {
    return null;
  }

  const date = new Date(retryAt);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleTimeString(language, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function formatAccountSyncRetryDateTime(retryAt: string | undefined, language: string): string | null {
  if (!retryAt) {
    return null;
  }

  const date = new Date(retryAt);
  if (Number.isNaN(date.getTime())) {
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

export function formatAccountLastSuccessLabel(lastSuccessAt: string | undefined, language: string): {
  date: string;
  time: string;
  isToday: boolean;
} | null {
  if (!lastSuccessAt) {
    return null;
  }

  const date = new Date(lastSuccessAt);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const now = new Date();
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

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
