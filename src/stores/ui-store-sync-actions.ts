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
    lastSettledSessionId: 0,
  };
}

function normalizeSyncProgressCounts(event: Pick<SyncProgressEventDto, "total" | "completed">) {
  const total = Math.max(0, event.total);
  return {
    total,
    completed: Math.min(Math.max(0, event.completed), total),
  };
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
        // Ignore events for sessions that already finished (session_id <= lastSettledSessionId)
        if (event.session_id <= state.syncProgress.lastSettledSessionId) {
          return {};
        }

        const counts = normalizeSyncProgressCounts(event);
        const currentSessionId = state.syncProgress.sessionId;
        const isCurrentSession = currentSessionId === event.session_id;
        const isNewerSession = currentSessionId === null || event.session_id > currentSessionId;

        // Handle finished event: mark this session as settled
        if (event.stage === "finished") {
          const lastSettledSessionId = Math.max(state.syncProgress.lastSettledSessionId, event.session_id);

          // If this was the current session, clear to idle
          if (isCurrentSession) {
            return {
              syncProgress: {
                ...getIdleSyncProgress(),
                lastSettledSessionId,
              },
            };
          }

          // Otherwise just update lastSettledSessionId
          return {
            syncProgress: {
              ...state.syncProgress,
              lastSettledSessionId,
            },
          };
        }

        // For non-terminal events from older sessions: ignore
        if (!isNewerSession && !isCurrentSession) {
          return {};
        }

        // For newer sessions or first event while idle: start tracking this session
        const total = isCurrentSession ? Math.max(state.syncProgress.total, counts.total) : counts.total;
        const completed = Math.min(
          isCurrentSession ? Math.max(state.syncProgress.completed, counts.completed) : counts.completed,
          total,
        );
        const activeAccountIds = isCurrentSession ? new Set(state.syncProgress.activeAccountIds) : new Set<string>();
        if (event.account_id) {
          if (event.stage === "account_finished") {
            activeAccountIds.delete(event.account_id);
          } else if (event.stage === "account_started") {
            activeAccountIds.add(event.account_id);
          }
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
            lastSettledSessionId: state.syncProgress.lastSettledSessionId,
          },
        };
      }),
    clearSyncProgress: () => set({ syncProgress: getIdleSyncProgress() }),
  };
}
