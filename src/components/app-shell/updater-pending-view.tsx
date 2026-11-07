import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { AppToastView } from "@/design-system";
import { cancelPendingUpdate, retryPendingUpdate } from "@/hooks/updater/updater-pending-coordinator";
import { useUpdaterPendingStore } from "@/hooks/updater/updater-pending-store";
import {
  isLocalizableUserVisibleAppErrorMessage,
  localizeUserVisibleAppErrorMessage,
} from "@/lib/ui/localize-app-error-message";

export function UpdaterPendingView() {
  const pending = useUpdaterPendingStore((state) => state.pending);
  const { t } = useTranslation("common");
  const announcement = useRef<HTMLOutputElement>(null);
  const announced = useRef(false);
  useEffect(() => {
    if (pending.status === "idle") {
      announced.current = false;
      if (announcement.current) announcement.current.textContent = "";
    } else if (pending.status === "waiting" && !announced.current && announcement.current) {
      announcement.current.textContent = t(
        pending.kind === "restart" ? "updater.restart_pending_after_sync" : "updater.download_pending_after_sync",
      );
      announced.current = true;
    }
  }, [pending, t]);
  const liveRegion = <output ref={announcement} aria-live="polite" className="sr-only" />;
  if (pending.status === "idle" || (pending.status === "attempting" && pending.kind === "download")) return liveRegion;
  const failed = pending.status === "failed";
  const message = failed
    ? isLocalizableUserVisibleAppErrorMessage(pending.reason)
      ? localizeUserVisibleAppErrorMessage(pending.reason)
      : t(pending.kind === "restart" ? "updater.restart_failed_ready" : "updater.download_failed_keep_current")
    : pending.status === "attempting"
      ? t("updater.restarting")
      : t(pending.kind === "restart" ? "updater.restart_pending_after_sync" : "updater.download_pending_after_sync");
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
    <div className="pointer-events-auto">
      {liveRegion}
      <AppToastView
        position="static"
        testId="updater-pending"
        hideClose={pending.status === "attempting"}
        onClose={cancelPendingUpdate}
        toastMessage={{ message, actions, variant: "update", severity: failed ? "error" : undefined }}
      />
    </div>
  );
}
