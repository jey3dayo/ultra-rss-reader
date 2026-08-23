import type { StoreApi } from "zustand";
import type { ToastData } from "@/lib/ui/toast.types";
import type { UiStoreDialogActions, UiStoreState, UiStoreToastActions } from "@/stores/ui-store.types";

type UiStoreSet = StoreApi<UiStoreState>["setState"];

type UiStoreDialogSliceActions = UiStoreDialogActions & UiStoreToastActions;

export type UiStoreDialogToastRuntime = {
  clearToastDismissTimer: () => void;
  nextToastAnnouncementId: () => number;
  scheduleToastDismiss: (data: ToastData, set: UiStoreSet) => void;
};

function normalizeAccountSetupAccountId(accountId: string): string | null {
  const normalizedAccountId = accountId.trim();
  return normalizedAccountId.length > 0 ? normalizedAccountId : null;
}

export function createUiStoreDialogActions(
  set: UiStoreSet,
  toastRuntime: UiStoreDialogToastRuntime,
): UiStoreDialogSliceActions {
  return {
    openAddFeedDialog: () => set({ isAddFeedDialogOpen: true }),
    closeAddFeedDialog: () => set({ isAddFeedDialogOpen: false }),
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
    showToast: (message) => {
      toastRuntime.clearToastDismissTimer();
      const data: ToastData = typeof message === "string" ? { message } : message;
      set((state) => ({
        toastMessage: data,
        toastAnnouncements:
          state.toastAnnouncements.at(-1)?.message === data.message
            ? state.toastAnnouncements
            : [...state.toastAnnouncements, { id: toastRuntime.nextToastAnnouncementId(), message: data.message }],
      }));
      toastRuntime.scheduleToastDismiss(data, set);
    },
    clearToast: () => {
      toastRuntime.clearToastDismissTimer();
      set({ toastMessage: null });
    },
    clearToastAnnouncement: (id) =>
      set((state) => ({
        toastAnnouncements: state.toastAnnouncements.filter((announcement) => announcement.id !== id),
      })),
    showConfirm: (message, onConfirm, options) =>
      set({
        confirmDialog: {
          open: true,
          message,
          actionLabel: options?.actionLabel ?? null,
          actionAccessibleLabel: options?.actionAccessibleLabel ?? null,
          variant: options?.variant ?? "default",
          icon: options?.icon ?? null,
          onConfirm,
        },
      }),
    closeConfirm: () =>
      set({
        confirmDialog: {
          open: false,
          message: "",
          actionLabel: null,
          actionAccessibleLabel: null,
          variant: "default",
          icon: null,
          onConfirm: null,
        },
      }),
  };
}
