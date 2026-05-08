export type ToastAction = {
  label: string;
  onClick: () => void;
};

export type ToastSeverity = "info" | "success" | "warning" | "error";

export type ToastData = {
  message: string;
  persistent?: boolean;
  progress?: number | null;
  actions?: ToastAction[];
  variant?: "update";
  severity?: ToastSeverity;
};
