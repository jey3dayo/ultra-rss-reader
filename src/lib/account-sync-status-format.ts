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
