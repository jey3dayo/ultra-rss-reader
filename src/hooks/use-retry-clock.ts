import { useEffect, useState } from "react";
import { getFutureAccountSyncRetry } from "@/lib/account/account-sync-status-format";

type RetryStatus = { next_retry_at?: string | null; waiting_for_credential_access?: boolean | null } | undefined;

export function useRetryClock(statuses: readonly RetryStatus[]): number {
  const [now, setNow] = useState(() => Date.now());
  const nextDeadline = statuses.reduce<number | null>((nearest, status) => {
    const deadline = getFutureAccountSyncRetry(status, now);
    return deadline !== null && (nearest === null || deadline < nearest) ? deadline : nearest;
  }, null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      const current = Date.now();
      setNow(current);
      clearTimeout(timer);
      if (nextDeadline !== null && current < nextDeadline) {
        timer = setTimeout(refresh, Math.min(nextDeadline - current, 2_147_483_647));
      }
    };
    if (nextDeadline !== null)
      timer = setTimeout(refresh, Math.max(0, Math.min(nextDeadline - Date.now(), 2_147_483_647)));
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [nextDeadline]);
  return now;
}
