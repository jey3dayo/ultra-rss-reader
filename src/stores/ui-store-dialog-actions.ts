import type { StoreApi } from "zustand";
import type { ToastData } from "@/lib/ui/toast.types";
import type { UiStoreState, UiStoreToastActions } from "@/stores/ui-store.types";

type UiStoreSet = StoreApi<UiStoreState>["setState"];

type UiStoreDialogSliceActions = Pick<
  UiStoreState,
  "openAddFeedDialog" | "closeAddFeedDialog" | "showConfirm" | "closeConfirm"
> &
  UiStoreToastActions;

export type UiStoreDialogToastRuntime = {
  clearToastDismissTimer: () => void;
  nextToastAnnouncementId: () => number;
  scheduleToastDismiss: (data: ToastData, set: UiStoreSet) => void;
};

export function createUiStoreDialogActions(
  set: UiStoreSet,
  toastRuntime: UiStoreDialogToastRuntime,
): UiStoreDialogSliceActions {
  return {
    openAddFeedDialog: () => set({ isAddFeedDialogOpen: true }),
    closeAddFeedDialog: () => set({ isAddFeedDialogOpen: false }),
    showToast: (message) => {
      toastRuntime.clearToastDismissTimer();
      const data: ToastData = typeof message === "string" ? { message } : message;
      let canReplace = true;
      set((state) => {
        const isRoutineToast = !data.persistent && data.severity !== "warning" && data.severity !== "error";
        canReplace = !(state.toastMessage?.variant === "sync-recovery" && isRoutineToast);
        return {
          toastMessage: canReplace ? data : state.toastMessage,
          toastAnnouncements:
            state.toastAnnouncements.at(-1)?.message === data.message
              ? state.toastAnnouncements
              : [...state.toastAnnouncements, { id: toastRuntime.nextToastAnnouncementId(), message: data.message }],
        };
      });
      if (canReplace) toastRuntime.scheduleToastDismiss(data, set);
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
