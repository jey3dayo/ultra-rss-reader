import type { UiFeedbackAction } from "@/lib/ui/action.types";

// Toasts share only the minimal label/callback action primitive with display states;
// severity, progress, persistence, and update variants stay toast-specific.
export type ToastAction = UiFeedbackAction;

export type ToastSeverity = "info" | "success" | "warning" | "error";

export type ToastCoalesceItem = { id: string; label: string };

// A routine toast with the same key as the toast currently displayed merges into it;
// `compose` rebuilds the user-facing parts from the accumulated items.
export type ToastCoalesce = {
  key: string;
  items: ToastCoalesceItem[];
  compose: (items: ToastCoalesceItem[]) => Pick<ToastData, "message" | "actions">;
};

export type ToastData = {
  message: string;
  persistent?: boolean;
  progress?: number | null;
  actions?: ToastAction[];
  variant?: "update" | "sync-recovery";
  severity?: ToastSeverity;
  coalesce?: ToastCoalesce;
};
