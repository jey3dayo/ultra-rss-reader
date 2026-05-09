import type { UiFeedbackAction } from "@/lib/ui/action.types";

// Toasts share only the minimal label/callback action primitive with display states;
// severity, progress, persistence, and update variants stay toast-specific.
export type ToastAction = UiFeedbackAction;

export type ToastSeverity = "info" | "success" | "warning" | "error";

export type ToastData = {
  message: string;
  persistent?: boolean;
  progress?: number | null;
  actions?: ToastAction[];
  variant?: "update";
  severity?: ToastSeverity;
};
