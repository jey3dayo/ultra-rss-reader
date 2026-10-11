import { sampleAccounts } from "@tests/helpers/fixtures";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveSidebarSyncFeedbackMessage } from "@/components/reader/sidebar-sync-feedback";
import { formatAccountSyncRetryTime } from "@/lib/account/account-sync-status-format";
import { createFetchErrorsToastAction } from "@/lib/actions";
import i18n from "@/lib/i18n";
import { queryClient } from "@/lib/query/query-client";
import { queryKeys } from "@/lib/query/query-invalidation";
import type { SyncFeedback } from "@/lib/sync/sync-result-feedback";

function getSidebarT() {
  return i18n.getFixedT(i18n.language, "sidebar");
}

describe("sidebar-sync-feedback", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  afterEach(() => {
    queryClient.clear();
  });

  it("formats scheduled retry feedback with the localized retry time", () => {
    const feedback: SyncFeedback = {
      kind: "retry-scheduled",
      accounts: "FreshRSS",
      retryAt: "2026-04-13T03:15:00Z",
      detail: null,
      remainingWarningCount: 0,
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
      detail: null,
      remainingWarningCount: 0,
    };

    expect(resolveSidebarSyncFeedbackMessage(getSidebarT(), feedback)).toBe(
      "Sync completed with warnings for: FreshRSS, Local",
    );
  });

  it("shows a concise localized summary for local feed failures", async () => {
    await i18n.changeLanguage("ja");
    const feedback: SyncFeedback = {
      kind: "warnings",
      accounts: "ローカル",
      detail: null,
      remainingWarningCount: 0,
      localFeedSyncFailureCount: 3,
      localFeedSyncFailureAccountId: "local-account",
    };

    expect(resolveSidebarSyncFeedbackMessage(getSidebarT(), feedback)).toBe(
      "同期が完了しました。3件のフィードを更新できませんでした",
    );
  });

  it("keeps other warning feedback and adds the failed feed count", () => {
    const feedback: SyncFeedback = {
      kind: "warnings",
      accounts: "Local",
      detail: { type: "feed_skipped_entries", feed_title: "News", count: 2 },
      remainingWarningCount: 0,
      localFeedSyncFailureCount: 9,
      localFeedSyncFailureAccountId: "local-account",
      otherWarningCount: 1,
    };

    expect(resolveSidebarSyncFeedbackMessage(getSidebarT(), feedback)).toBe(
      "Sync completed with warnings for: Local 'News' skipped 2 entries during sync Sync completed. Some feeds could not be updated (9).",
    );
  });

  it("does not offer the fetch-error action for a remote account", () => {
    const account = { ...sampleAccounts[1], kind: "FreshRss" };
    queryClient.setQueryData(queryKeys.accounts.root, [account]);

    expect(createFetchErrorsToastAction(account.id, "View details")).toBeNull();
  });

  it("formats partial failure feedback with the affected account list", () => {
    const feedback: SyncFeedback = {
      kind: "partial-failure",
      accounts: "FreshRSS, Local",
    };

    expect(resolveSidebarSyncFeedbackMessage(getSidebarT(), feedback)).toBe("Sync failed for: FreshRSS, Local");
  });

  it("appends the localized detail sentence for a single warning", () => {
    const feedback: SyncFeedback = {
      kind: "warnings",
      accounts: "FreshRSS",
      detail: { type: "feed_skipped_entries", feed_title: "Tech News", count: 3 },
      remainingWarningCount: 0,
    };

    expect(resolveSidebarSyncFeedbackMessage(getSidebarT(), feedback)).toBe(
      "Sync completed with warnings for: FreshRSS 'Tech News' skipped 3 entries during sync",
    );
  });

  it("appends the detail sentence plus a remaining-count suffix for multiple warnings", () => {
    const feedback: SyncFeedback = {
      kind: "warnings",
      accounts: "FreshRSS",
      detail: { type: "feed_skipped_entries", feed_title: "Tech News", count: 1 },
      remainingWarningCount: 2,
    };

    expect(resolveSidebarSyncFeedbackMessage(getSidebarT(), feedback)).toBe(
      "Sync completed with warnings for: FreshRSS 'Tech News' skipped 1 entry during sync +2 more issues",
    );
  });

  it("appends a detail sentence for a retry-pending feedback so retry-only warnings keep detail", () => {
    const feedback: SyncFeedback = {
      kind: "retry-pending",
      accounts: "FreshRSS",
      detail: { type: "pending_mutation_retry", mutation: "mark_read" },
      remainingWarningCount: 0,
    };

    expect(resolveSidebarSyncFeedbackMessage(getSidebarT(), feedback)).toBe(
      "Sync completed, but some changes for FreshRSS will retry next sync 'mark as read' will retry on the next sync",
    );
  });

  it("localizes the mark_read mutation label instead of leaking the raw protocol value", () => {
    const feedback: SyncFeedback = {
      kind: "retry-pending",
      accounts: "FreshRSS",
      detail: { type: "pending_mutation_retry", mutation: "mark_read" },
      remainingWarningCount: 0,
    };

    const message = resolveSidebarSyncFeedbackMessage(getSidebarT(), feedback);

    expect(message).toContain("mark as read");
    expect(message).not.toContain("mark_read");
  });

  it("localizes the mark_read mutation label in Japanese", async () => {
    await i18n.changeLanguage("ja");
    const feedback: SyncFeedback = {
      kind: "retry-pending",
      accounts: "FreshRSS",
      detail: { type: "pending_mutation_retry", mutation: "mark_read" },
      remainingWarningCount: 0,
    };

    const message = resolveSidebarSyncFeedbackMessage(getSidebarT(), feedback);

    expect(message).toContain("記事の既読化");
    expect(message).not.toContain("mark_read");
  });

  it("falls back to the raw mutation value when it is not a known label", () => {
    const feedback: SyncFeedback = {
      kind: "retry-pending",
      accounts: "FreshRSS",
      detail: { type: "pending_mutation_retry", mutation: "some_future_mutation" },
      remainingWarningCount: 0,
    };

    const message = resolveSidebarSyncFeedbackMessage(getSidebarT(), feedback);

    expect(message).toContain("some_future_mutation");
  });

  it("localizes the import operation label instead of leaking the raw operation value", () => {
    const feedback: SyncFeedback = {
      kind: "warnings",
      accounts: "Local",
      detail: { type: "local_account_sync_operation_failed", operation: "import", message: "boom" },
      remainingWarningCount: 0,
    };

    const message = resolveSidebarSyncFeedbackMessage(getSidebarT(), feedback);

    expect(message).toContain("Local sync import failed");
  });

  it("falls back to the raw operation value when it is not a known label", () => {
    const feedback: SyncFeedback = {
      kind: "warnings",
      accounts: "Local",
      detail: { type: "local_account_sync_operation_failed", operation: "some_future_operation", message: "boom" },
      remainingWarningCount: 0,
    };

    const message = resolveSidebarSyncFeedbackMessage(getSidebarT(), feedback);

    expect(message).toContain("some_future_operation");
  });

  it("localizes the detail sentence in Japanese", async () => {
    await i18n.changeLanguage("ja");
    const feedback: SyncFeedback = {
      kind: "warnings",
      accounts: "FreshRSS",
      detail: { type: "feed_skipped_entries", feed_title: "Tech News", count: 3 },
      remainingWarningCount: 0,
    };

    expect(resolveSidebarSyncFeedbackMessage(getSidebarT(), feedback)).toBe(
      "同期は完了しましたが、FreshRSS で問題が見つかりました 「Tech News」で同期中に 3 件のエントリをスキップしました",
    );
  });

  it("omits the detail sentence when every warning normalized to a null detail", () => {
    const feedback: SyncFeedback = {
      kind: "warnings",
      accounts: "FreshRSS",
      detail: null,
      remainingWarningCount: 0,
    };

    expect(resolveSidebarSyncFeedbackMessage(getSidebarT(), feedback)).toBe(
      "Sync completed with warnings for: FreshRSS",
    );
  });
});
