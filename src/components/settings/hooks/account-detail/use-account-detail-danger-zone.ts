import { Result } from "@praha/byethrow";
import type { QueryClient, QueryKey } from "@tanstack/react-query";
import type { TFunction } from "i18next";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  deleteAccount,
  exportLocalAccountSyncOperations,
  exportOpmlToFile,
  getLocalAccountSyncSettings,
  importLocalAccountSyncOperations,
  importOpml,
  setLocalAccountSyncSettings,
} from "@/api/tauri-commands";
import { showSaveDialog } from "@/lib/platform/save-dialog";
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

const TAGS_QUERY_KEY = ["tags"] as const;
const ARTICLE_TAGS_QUERY_KEY = ["articleTags"] as const;
const MUTE_KEYWORD_QUERY_KEY = ["muteKeywords"] as const;

export type AccountDetailDangerZoneResult = {
  handleImportOpml: (file: File) => Promise<void>;
  handleExportOpml: () => Promise<void>;
  localSyncFolderPath: string;
  setLocalSyncFolderPath: (value: string) => void;
  localSyncEnabled: boolean;
  handleToggleLocalSyncEnabled: (next: boolean) => void;
  handleSaveLocalSyncFolder: () => Promise<void>;
  handleExportLocalSyncOperations: () => Promise<void>;
  handleImportLocalSyncOperations: () => Promise<void>;
  handleRequestDelete: () => void;
  importingOpml: boolean;
  exportingOpml: boolean;
  loadingLocalSyncSettings: boolean;
  savingLocalSyncSettings: boolean;
  exportingLocalSyncOperations: boolean;
  importingLocalSyncOperations: boolean;
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

function invalidateLocalAccountSyncImportQueries(queryClient: QueryClient): void {
  invalidateOpmlImportQueries(queryClient);
  invalidateArticleQueries(queryClient, {
    includeFeeds: false,
    includeTagArticleCounts: true,
  });
  invalidateQueryKeysLogOnly(queryClient, [TAGS_QUERY_KEY, ARTICLE_TAGS_QUERY_KEY, MUTE_KEYWORD_QUERY_KEY]);
}

export function useAccountDetailDangerZone({
  account,
  queryClient,
  t,
  onAccountDeleted,
}: AccountDetailDangerZoneParams): AccountDetailDangerZoneResult {
  const importInFlightRef = useRef(false);
  const exportInFlightRef = useRef(false);
  const [importingOpml, setImportingOpml] = useState(false);
  const [exportingOpml, setExportingOpml] = useState(false);
  const [localSyncFolderPath, setLocalSyncFolderPath] = useState("");
  const [localSyncEnabled, setLocalSyncEnabled] = useState(true);
  const [loadingLocalSyncSettings, setLoadingLocalSyncSettings] = useState(false);
  const [savingLocalSyncSettings, setSavingLocalSyncSettings] = useState(false);
  const [exportingLocalSyncOperations, setExportingLocalSyncOperations] = useState(false);
  const [importingLocalSyncOperations, setImportingLocalSyncOperations] = useState(false);
  const mountedRef = useRef(true);
  const { t: tc } = useTranslation("common");
  const showConfirm = useUiStore((state) => state.showConfirm);
  const showImportError = createAccountDetailErrorToast(t, "account.failed_to_import_opml");
  const showExportError = createAccountDetailErrorToast(t, "account.failed_to_export_opml");
  const showLocalSyncSettingsError = useCallback(
    createAccountDetailErrorToast(t, "account.local_sync_settings_failed"),
    [],
  );
  const showLocalSyncExportError = useCallback(
    createAccountDetailErrorToast(t, "account.local_sync_export_failed"),
    [],
  );
  const showLocalSyncImportError = useCallback(
    createAccountDetailErrorToast(t, "account.local_sync_import_failed"),
    [],
  );
  const showDeleteError = createAccountDetailErrorToast(t, "account.failed_to_delete");
  const savedAccountId = usePreferencesStore((state) => state.prefs.selected_account_id ?? "");
  const setPref = usePreferencesStore((state) => state.setPref);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (account.kind !== "Local") {
      setLocalSyncFolderPath("");
      setLocalSyncEnabled(true);
      return;
    }

    let cancelled = false;
    setLoadingLocalSyncSettings(true);
    void getLocalAccountSyncSettings(account.id)
      .then((result) => {
        if (cancelled || !mountedRef.current) return;
        Result.pipe(
          result,
          Result.inspectError(showLocalSyncSettingsError),
          Result.inspect((settings) => {
            setLocalSyncFolderPath(settings?.sync_folder_path ?? "");
            setLocalSyncEnabled(settings?.enabled ?? true);
          }),
        );
      })
      .finally(() => {
        if (!cancelled && mountedRef.current) {
          setLoadingLocalSyncSettings(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [account.id, account.kind, showLocalSyncSettingsError]);

  const handleImportOpml = async (file: File) => {
    if (importInFlightRef.current) {
      return;
    }

    const importAccountId = account.id;
    importInFlightRef.current = true;
    setImportingOpml(true);
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
      if (mountedRef.current) {
        setImportingOpml(false);
      }
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
    setExportingOpml(true);
    try {
      const path = await showSaveDialog({
        defaultPath: buildOpmlExportFilename(exportAccountSnapshot.name),
        filters: [{ name: "OPML", extensions: ["opml"] }],
      });
      if (path === null || !mountedRef.current) {
        return;
      }

      const exportResult = await exportOpmlToFile(exportAccountSnapshot.id, path);
      if (!mountedRef.current) {
        return;
      }

      Result.pipe(exportResult, Result.inspectError(showExportError));
    } catch (error) {
      if (mountedRef.current) {
        showExportError({ message: getErrorMessage(error) });
      }
    } finally {
      exportInFlightRef.current = false;
      if (mountedRef.current) {
        setExportingOpml(false);
      }
    }
  };

  const handleSaveLocalSyncFolder = async () => {
    if (account.kind !== "Local" || savingLocalSyncSettings) return;
    setSavingLocalSyncSettings(true);
    try {
      Result.pipe(
        await setLocalAccountSyncSettings(account.id, localSyncFolderPath, localSyncEnabled),
        Result.inspectError(showLocalSyncSettingsError),
        Result.inspect((settings) => {
          setLocalSyncFolderPath(settings.sync_folder_path);
          setLocalSyncEnabled(settings.enabled);
          useUiStore.getState().showToast(t("account.local_sync_settings_saved"));
        }),
      );
    } finally {
      if (mountedRef.current) {
        setSavingLocalSyncSettings(false);
      }
    }
  };

  const handleToggleLocalSyncEnabled = (next: boolean) => {
    if (account.kind !== "Local") return;
    // Optimistic toggle: on persist failure we intentionally keep the toggled
    // value (retain, not rollback) for parity with handleSaveLocalSyncFolder,
    // which never reverts localSyncFolderPath/localSyncEnabled on failure
    // either. The error toast is the user-visible signal; see the
    // "keeps the toggled value" failure-path test below.
    setLocalSyncEnabled(next);
    if (localSyncFolderPath.trim().length === 0 || savingLocalSyncSettings) {
      return;
    }

    setSavingLocalSyncSettings(true);
    void setLocalAccountSyncSettings(account.id, localSyncFolderPath, next)
      .then((result) => {
        if (!mountedRef.current) return;
        Result.pipe(
          result,
          Result.inspectError(showLocalSyncSettingsError),
          Result.inspect((settings) => {
            setLocalSyncFolderPath(settings.sync_folder_path);
            setLocalSyncEnabled(settings.enabled);
            useUiStore
              .getState()
              .showToast(
                t(settings.enabled ? "account.local_sync_enabled_saved_on" : "account.local_sync_enabled_saved_off"),
              );
          }),
        );
      })
      .finally(() => {
        if (mountedRef.current) {
          setSavingLocalSyncSettings(false);
        }
      });
  };

  const handleExportLocalSyncOperations = async () => {
    if (account.kind !== "Local" || exportingLocalSyncOperations) return;
    setExportingLocalSyncOperations(true);
    try {
      Result.pipe(
        await exportLocalAccountSyncOperations(account.id),
        Result.inspectError(showLocalSyncExportError),
        Result.inspect((report) => {
          useUiStore.getState().showToast(t("account.local_sync_export_success", { count: report.operations_written }));
        }),
      );
    } finally {
      if (mountedRef.current) {
        setExportingLocalSyncOperations(false);
      }
    }
  };

  const handleImportLocalSyncOperations = async () => {
    if (account.kind !== "Local" || importingLocalSyncOperations) return;
    setImportingLocalSyncOperations(true);
    try {
      Result.pipe(
        await importLocalAccountSyncOperations(account.id),
        Result.inspectError(showLocalSyncImportError),
        Result.inspect((report) => {
          if (report.applied) {
            invalidateLocalAccountSyncImportQueries(queryClient);
          }
          useUiStore.getState().showToast(
            report.applied
              ? t("account.local_sync_import_success", { count: report.applied_operations })
              : t("account.local_sync_import_blocked", {
                  rejected: report.rejected_files,
                  conflicted: report.conflicted_candidates,
                }),
          );
        }),
      );
    } finally {
      if (mountedRef.current) {
        setImportingLocalSyncOperations(false);
      }
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
    localSyncFolderPath,
    setLocalSyncFolderPath,
    localSyncEnabled,
    handleToggleLocalSyncEnabled,
    handleSaveLocalSyncFolder,
    handleExportLocalSyncOperations,
    handleImportLocalSyncOperations,
    handleRequestDelete,
    importingOpml,
    exportingOpml,
    loadingLocalSyncSettings,
    savingLocalSyncSettings,
    exportingLocalSyncOperations,
    importingLocalSyncOperations,
  };
}
