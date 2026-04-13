import { beforeEach, describe, expect, it } from "vitest";
import { resolveSidebarSyncFeedbackMessage } from "@/components/reader/sidebar-sync-feedback";
import { formatAccountSyncRetryTime } from "@/lib/account-sync-status-format";
import i18n from "@/lib/i18n";
import type { SyncFeedback } from "@/lib/sync-result-feedback";

function getSidebarT() {
  return i18n.getFixedT(i18n.language, "sidebar");
}

describe("sidebar-sync-feedback", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("formats scheduled retry feedback with the localized retry time", () => {
    const feedback: SyncFeedback = {
      kind: "retry-scheduled",
      accounts: "FreshRSS",
      retryAt: "2026-04-13T03:15:00Z",
    };
    const retryTime = formatAccountSyncRetryTime(feedback.retryAt, i18n.language);

    expect(resolveSidebarSyncFeedbackMessage(getSidebarT(), feedback)).toBe(
      retryTime
        ? `Background sync failed for FreshRSS. Retrying at ${retryTime}`
        : "Background sync failed for FreshRSS. Retrying soon",
    );
  });

  it("formats warning feedback with the affected account list", () => {
    const feedback: SyncFeedback = {
      kind: "warnings",
      accounts: "FreshRSS, Local",
    };

    expect(resolveSidebarSyncFeedbackMessage(getSidebarT(), feedback)).toBe(
      "Sync completed with warnings for: FreshRSS, Local",
    );
  });
});
