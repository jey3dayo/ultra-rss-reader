import { Result } from "@praha/byethrow";
import type { QueryClient, QueryKey } from "@tanstack/react-query";
import type { TFunction } from "i18next";
import { useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { deleteAccount, exportOpml, importOpml } from "@/api/tauri-commands";
import {
  getQueryKeyRootName,
  getQueryKeyScopeValue,
  invalidateArticleQueries,
  invalidateFeedQueries,
  invalidateOpmlImportQueries,
  invalidateQueryKeysLogOnly,
  queryKeys,
} from "@/lib/query/query-invalidation";
import { getErrorMessage } from "@/lib/ui/errors";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";
import { createAccountDetailErrorToast } from "../../account-detail/toast";
import type { AccountDetailAccount } from "../../account-detail/types";

type AccountDetailDangerZoneParams = {
  account: AccountDetailAccount;
  queryClient: QueryClient;
  t: TFunction<"settings">;
  onAccountDeleted: () => void;
};

export type AccountDetailDangerZoneResult = {
  handleImportOpml: (file: File) => Promise<void>;
  handleExportOpml: () => Promise<void>;
  handleRequestDelete: () => void;
};

export function buildOpmlExportFilename(accountName: string): string {
  const safeName = accountName
    .trim()
    .replace(/[<>:"/\\|?*]/g, "")
    .trim();
  return safeName ? `${safeName}-feeds.opml` : "feeds.opml";
}

function collectDeletedAccountFeedIds(queryClient: QueryClient, deletedAccountId: string): Set<string> {
  const feedIds = new Set<string>();
  const feedQueryResults = queryClient.getQueriesData<unknown>({
    queryKey: queryKeys.feeds.root,
  });

  for (const [, data] of feedQueryResults) {
    if (!Array.isArray(data)) {
      continue;
    }

    for (const candidate of data) {
      if (
        candidate &&
        typeof candidate === "object" &&
        "id" in candidate &&
        typeof candidate.id === "string" &&
        "account_id" in candidate &&
        candidate.account_id === deletedAccountId
      ) {
        feedIds.add(candidate.id);
      }
    }
  }

  return feedIds;
}

function isDeletedAccountArticleQuery(
  queryKey: QueryKey,
  deletedAccountId: string,
  deletedFeedIds: Set<string>,
): boolean {
  const root = getQueryKeyRootName(queryKey);

  if (
    (root === queryKeys.accountArticles.root[1] ||
      root === queryKeys.starredArticles.root[1] ||
      root === queryKeys.recentArticles.root[1] ||
      root === queryKeys.search.root[1] ||
      root === queryKeys.feedArticleSummaries.root[1]) &&
    getQueryKeyScopeValue(queryKey, 0) === deletedAccountId
  ) {
    return true;
  }

  if (root === queryKeys.articlesByTag.root[1] && getQueryKeyScopeValue(queryKey, 1) === deletedAccountId) {
    return true;
  }

  const feedId = getQueryKeyScopeValue(queryKey, 0);
  return root === queryKeys.articles.root[1] && typeof feedId === "string" && deletedFeedIds.has(feedId);
}

function removeDeletedAccountArticleCaches(queryClient: QueryClient, deletedAccountId: string): void {
  const deletedFeedIds = collectDeletedAccountFeedIds(queryClient, deletedAccountId);
  queryClient.removeQueries({
    predicate: ({ queryKey }) => isDeletedAccountArticleQuery(queryKey, deletedAccountId, deletedFeedIds),
  });
}

export function useAccountDetailDangerZone({
  account,
  queryClient,
  t,
  onAccountDeleted,
}: AccountDetailDangerZoneParams): AccountDetailDangerZoneResult {
  const importInFlightRef = useRef(false);
  const exportInFlightRef = useRef(false);
  const pendingExportUrlRef = useRef<string | null>(null);
  const pendingExportUrlTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const { t: tc } = useTranslation("common");
  const showConfirm = useUiStore((state) => state.showConfirm);
  const showImportError = createAccountDetailErrorToast(t, "account.failed_to_import_opml");
  const showExportError = createAccountDetailErrorToast(t, "account.failed_to_export_opml");
  const showDeleteError = createAccountDetailErrorToast(t, "account.failed_to_delete");
  const savedAccountId = usePreferencesStore((state) => state.prefs.selected_account_id ?? "");
  const setPref = usePreferencesStore((state) => state.setPref);

  const revokePendingExportUrl = useCallback(() => {
    if (pendingExportUrlTimerRef.current !== null) {
      clearTimeout(pendingExportUrlTimerRef.current);
      pendingExportUrlTimerRef.current = null;
    }

    if (pendingExportUrlRef.current !== null) {
      URL.revokeObjectURL(pendingExportUrlRef.current);
      pendingExportUrlRef.current = null;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      revokePendingExportUrl();
    };
  }, [revokePendingExportUrl]);

  useEffect(() => {
    const accountId = account.id;
    void accountId;
    revokePendingExportUrl();
  }, [account.id, revokePendingExportUrl]);

  const handleImportOpml = async (file: File) => {
    if (importInFlightRef.current) {
      return;
    }

    const importAccountId = account.id;
    importInFlightRef.current = true;
    try {
      const opmlContent = await file.text();
      const importResult = await importOpml(importAccountId, opmlContent);
      if (!mountedRef.current) {
        return;
      }

      Result.pipe(
        importResult,
        Result.inspectError(showImportError),
        Result.inspect(() => {
          invalidateOpmlImportQueries(queryClient);
          useUiStore.getState().showToast(t("account.import_opml_success"));
        }),
      );
    } catch (error) {
      if (mountedRef.current) {
        showImportError({ message: getErrorMessage(error) });
      }
    } finally {
      importInFlightRef.current = false;
    }
  };

  const handleExportOpml = async () => {
    if (exportInFlightRef.current) {
      return;
    }

    const exportAccountSnapshot = {
      id: account.id,
      name: account.name,
    };
    exportInFlightRef.current = true;
    try {
      const exportResult = await exportOpml(exportAccountSnapshot.id);
      if (!mountedRef.current) {
        return;
      }

      Result.pipe(
        exportResult,
        Result.inspectError(showExportError),
        Result.inspect((opmlString) => {
          const blob = new Blob([opmlString], { type: "application/xml" });
          revokePendingExportUrl();
          const url = URL.createObjectURL(blob);
          const anchor = document.createElement("a");
          anchor.href = url;
          anchor.download = buildOpmlExportFilename(exportAccountSnapshot.name);
          pendingExportUrlRef.current = url;
          try {
            anchor.click();
            pendingExportUrlTimerRef.current = setTimeout(() => {
              revokePendingExportUrl();
            }, 1000);
          } catch {
            revokePendingExportUrl();
          }
        }),
      );
    } finally {
      exportInFlightRef.current = false;
    }
  };

  const handleDelete = async () => {
    Result.pipe(
      await deleteAccount(account.id),
      Result.inspectError(showDeleteError),
      Result.inspect(() => {
        const accounts = queryClient.getQueryData<AccountDetailAccount[]>(queryKeys.accounts.root) ?? [];
        const remainingAccountIds = accounts
          .filter((cachedAccount) => cachedAccount.id !== account.id)
          .map((cachedAccount) => cachedAccount.id);
        const fallbackAccountId = remainingAccountIds[0] ?? "";

        useUiStore.getState().handleAccountDeleted(account.id, remainingAccountIds);
        removeDeletedAccountArticleCaches(queryClient, account.id);
        if (savedAccountId.trim() === account.id) {
          setPref("selected_account_id", fallbackAccountId);
        }

        invalidateQueryKeysLogOnly(queryClient, [queryKeys.accounts.root]);
        invalidateFeedQueries(queryClient, { includeFolders: false });
        invalidateArticleQueries(queryClient, {
          includeTagArticleCounts: true,
        });
        onAccountDeleted();
      }),
    );
  };

  const handleRequestDelete = () => {
    showConfirm(t("account.confirm_delete", { name: account.name }), () => handleDelete(), {
      actionLabel: tc("delete"),
      actionAccessibleLabel: t("account.delete_account_accessible_label", {
        defaultValue: `${tc("delete")} "${account.name}". This cannot be undone.`,
        name: account.name,
      }),
      variant: "destructive",
    });
  };

  return {
    handleImportOpml,
    handleExportOpml,
    handleRequestDelete,
  };
}
