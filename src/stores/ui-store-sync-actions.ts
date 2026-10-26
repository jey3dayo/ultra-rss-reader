import type { StoreApi } from "zustand";
import type { SyncProgressEventDto } from "@/api/schemas/sync-progress";
import type {
  SyncProgressUiState,
  UiStoreAccountSetupActions,
  UiStoreState,
  UiStoreSyncProgressActions,
} from "@/stores/ui-store.types";

type UiStoreSet = StoreApi<UiStoreState>["setState"];
type UiStoreSyncActions = UiStoreSyncProgressActions & UiStoreAccountSetupActions;

export function getIdleSyncProgress(): SyncProgressUiState {
  return {
    active: false,
    sessionId: null,
    kind: null,
    stage: null,
    total: 0,
    completed: 0,
    currentAccountName: null,
    activeAccountIds: new Set(),
  };
}

function normalizeSyncProgressCounts(event: Pick<SyncProgressEventDto, "total" | "completed">) {
  const total = Math.max(0, event.total);
  return {
    total,
    completed: Math.min(Math.max(0, event.completed), total),
  };
}

function shouldIgnoreSyncProgressEvent(
  current: SyncProgressUiState,
  event: Pick<SyncProgressEventDto, "session_id">,
): boolean {
  return current.sessionId !== null && event.session_id < current.sessionId;
}

function normalizeAccountSetupAccountId(accountId: string): string | null {
  const normalizedAccountId = accountId.trim();
  return normalizedAccountId.length > 0 ? normalizedAccountId : null;
}

export function createUiStoreSyncActions(set: UiStoreSet): UiStoreSyncActions {
  return {
    startAccountSetupVerification: () =>
      set({
        accountSetupSession: {
          owner: "add-account",
          state: "verifying",
        },
      }),
    startAccountSetup: (accountId, options) =>
      set((state) => {
        const normalizedAccountId = normalizeAccountSetupAccountId(accountId);
        if (!normalizedAccountId) {
          return state;
        }

        return {
          accountSetupSession: {
            accountId: normalizedAccountId,
            owner: options?.owner ?? state.accountSetupSession?.owner ?? "account-detail",
            state: "syncing",
          },
        };
      }),
    markAccountSetupFailed: (accountId, errorMessage) =>
      set((state) => {
        const normalizedAccountId = normalizeAccountSetupAccountId(accountId);
        return !normalizedAccountId ||
          state.accountSetupSession?.state === "verifying" ||
          state.accountSetupSession?.accountId !== normalizedAccountId
          ? state
          : {
              accountSetupSession: {
                accountId: normalizedAccountId,
                owner: state.accountSetupSession.owner,
                state: "failed",
                ...(errorMessage ? { errorMessage } : {}),
              },
            };
      }),
    markAccountSetupSucceeded: (accountId) =>
      set((state) => {
        const normalizedAccountId = normalizeAccountSetupAccountId(accountId);
        return !normalizedAccountId ||
          state.accountSetupSession?.state === "verifying" ||
          state.accountSetupSession?.accountId !== normalizedAccountId
          ? state
          : {
              accountSetupSession: {
                accountId: normalizedAccountId,
                owner: state.accountSetupSession.owner,
                state: "succeeded",
              },
            };
      }),
    clearAccountSetup: () => set({ accountSetupSession: null }),
    applySyncProgress: (event) =>
      set((state) => {
        const counts = normalizeSyncProgressCounts(event);
        const currentSessionId = state.syncProgress.sessionId;
        const isCurrentSession = currentSessionId === event.session_id;
        const isOlderSession = currentSessionId !== null && event.session_id < currentSessionId;

        // Handle terminal events from older sessions to fix stuck state: when a newer
        // session starts before an older one finishes, the newer session resets
        // activeAccountIds, and the older session's terminal events are normally ignored
        // completely. But those terminal events signal that specific accounts are done,
        // so we process them to clean up activeAccountIds.
        if (isOlderSession && state.syncProgress.active) {
          if (event.stage === "finished") {
            // Older session finished: clear to idle.
            return {
              syncProgress: getIdleSyncProgress(),
            };
          }
          if (event.stage === "account_finished" && event.account_id) {
            // Remove this account from activeAccountIds even though it's from an older session.
            const activeAccountIds = new Set(state.syncProgress.activeAccountIds);
            activeAccountIds.delete(event.account_id);
            if (activeAccountIds.size === 0 && state.syncProgress.kind === "manual_account") {
              return {
                syncProgress: getIdleSyncProgress(),
              };
            }
            return {
              syncProgress: {
                ...state.syncProgress,
                activeAccountIds,
              },
            };
          }
          // Ignore non-terminal events from older sessions.
          return {};
        }

        // Ignore events from older sessions when we're idle (no cleanup needed).
        if (isOlderSession) {
          return {};
        }

        const total = isCurrentSession ? Math.max(state.syncProgress.total, counts.total) : counts.total;
        const completed = Math.min(
          isCurrentSession ? Math.max(state.syncProgress.completed, counts.completed) : counts.completed,
          total,
        );
        const activeAccountIds = isCurrentSession ? new Set(state.syncProgress.activeAccountIds) : new Set<string>();
        if (event.account_id) {
          if (event.stage === "account_finished" || event.stage === "finished") {
            activeAccountIds.delete(event.account_id);
          } else {
            activeAccountIds.add(event.account_id);
          }
        }

        if (event.stage === "finished") {
          return {
            syncProgress: getIdleSyncProgress(),
          };
        }

        return {
          syncProgress: {
            active: true,
            sessionId: event.session_id,
            kind: event.kind,
            stage: event.stage,
            total,
            completed,
            currentAccountName: event.account_name ?? (isCurrentSession ? state.syncProgress.currentAccountName : null),
            activeAccountIds,
          },
        };
      }),
    clearSyncProgress: () => set({ syncProgress: getIdleSyncProgress() }),
  };
}
