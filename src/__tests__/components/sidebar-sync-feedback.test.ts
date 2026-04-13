import { beforeEach, describe, expect, it } from "vitest";
import type { SyncFeedback } from "@/lib/sync-result-feedback";
import i18n from "@/lib/i18n";
import { resolveSidebarSyncFeedbackMessage } from "@/components/reader/sidebar-sync-feedback";

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

    expect(resolveSidebarSyncFeedbackMessage(getSidebarT(), feedback)).toBe(
      "Background sync failed for FreshRSS. Retrying at 12:15",
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
