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

function mergeCoalescedToast(current: ToastData | null, incoming: ToastData): ToastData {
  const coalesce = incoming.coalesce;
  const isRoutine = !incoming.persistent && incoming.severity !== "warning" && incoming.severity !== "error";
  if (!coalesce || !isRoutine || current?.coalesce?.key !== coalesce.key) return incoming;
  const knownIds = new Set(current.coalesce.items.map((item) => item.id));
  const items = [...current.coalesce.items, ...coalesce.items.filter((item) => !knownIds.has(item.id))];
  return { ...incoming, ...coalesce.compose(items), coalesce: { ...coalesce, items } };
}

export function createUiStoreDialogActions(
  set: UiStoreSet,
  toastRuntime: UiStoreDialogToastRuntime,
): UiStoreDialogSliceActions {
  return {
    openAddFeedDialog: () => set({ isAddFeedDialogOpen: true }),
    closeAddFeedDialog: () => set({ isAddFeedDialogOpen: false }),
    showToast: (message) => {
      toastRuntime.clearToastDismissTimer();
      const incoming: ToastData = typeof message === "string" ? { message } : message;
      let data = incoming;
      let canReplace = true;
      set((state) => {
        const isRoutineToast = !data.persistent && data.severity !== "warning" && data.severity !== "error";
        canReplace = !(state.toastMessage?.variant === "sync-recovery" && isRoutineToast);
        if (canReplace) data = mergeCoalescedToast(state.toastMessage, incoming);
        return {
          toastMessage: canReplace ? data : state.toastMessage,
          toastAnnouncements:
            state.toastAnnouncements.at(-1)?.message === incoming.message
              ? state.toastAnnouncements
              : [
                  ...state.toastAnnouncements,
                  { id: toastRuntime.nextToastAnnouncementId(), message: incoming.message },
                ],
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
