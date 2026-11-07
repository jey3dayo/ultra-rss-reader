import type { TFunction } from "i18next";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { AppToastView } from "@/design-system";
import { cancelPendingUpdate, retryPendingUpdate } from "@/hooks/updater/updater-pending-coordinator";
import { type PendingState, useUpdaterPendingStore } from "@/hooks/updater/updater-pending-store";
import {
  isLocalizableUserVisibleAppErrorMessage,
  localizeUserVisibleAppErrorMessage,
} from "@/lib/ui/localize-app-error-message";

function getPendingMessage(pending: Exclude<PendingState, { status: "idle" }>, t: TFunction<"common">): string {
  if (pending.status === "failed") {
    return isLocalizableUserVisibleAppErrorMessage(pending.reason)
      ? localizeUserVisibleAppErrorMessage(pending.reason)
      : t(pending.kind === "restart" ? "updater.restart_failed_ready" : "updater.download_failed_keep_current");
  }
  if (pending.status === "attempting") {
    return t("updater.restarting");
  }
  return t(pending.kind === "restart" ? "updater.restart_pending_after_sync" : "updater.download_pending_after_sync");
}

export function UpdaterPendingView() {
  const pending = useUpdaterPendingStore((state) => state.pending);
  const { t } = useTranslation("common");
  const announcement = useRef<HTMLOutputElement>(null);
  const announcedWaiting = useRef(false);
  const announcedFailureRequestId = useRef<number | null>(null);
  useEffect(() => {
    const region = announcement.current;
    if (!region) return;
    if (pending.status === "idle") {
      announcedWaiting.current = false;
      announcedFailureRequestId.current = null;
      region.textContent = "";
      return;
    }
    // Announce entering the waiting state once per request (fallback retries cycle
    // through attempting/waiting) and every transition into a failure.
    if (pending.status === "waiting" && !announcedWaiting.current) {
      region.textContent = getPendingMessage(pending, t);
      announcedWaiting.current = true;
    } else if (pending.status === "failed" && announcedFailureRequestId.current !== pending.requestId) {
      region.textContent = getPendingMessage(pending, t);
      announcedFailureRequestId.current = pending.requestId;
      announcedWaiting.current = false;
    }
  }, [pending, t]);
  // Keep the live region mounted at a stable position so announcements are not
  // lost when the visible surface appears or disappears.
  const liveRegion = (
    <output ref={announcement} aria-live="polite" className="sr-only" data-testid="updater-pending-live-region" />
  );
  if (pending.status === "idle" || (pending.status === "attempting" && pending.kind === "download")) {
    return liveRegion;
  }
  const failed = pending.status === "failed";
  const message = getPendingMessage(pending, t);
  const actions = failed
    ? [
        {
          label: t(pending.kind === "restart" ? "updater.restart_again" : "updater.check_again"),
          onClick: retryPendingUpdate,
        },
        { label: t("updater.later"), onClick: cancelPendingUpdate },
      ]
    : pending.status === "waiting"
      ? [{ label: t("updater.cancel_restart_pending"), onClick: cancelPendingUpdate }]
      : [];
  return (
    <>
      {liveRegion}
      <div className="pointer-events-auto">
        <AppToastView
          position="static"
          testId="updater-pending"
          hideClose={pending.status === "attempting"}
          onClose={cancelPendingUpdate}
          toastMessage={{ message, actions, variant: "update", severity: failed ? "error" : undefined }}
        />
      </div>
    </>
  );
}
