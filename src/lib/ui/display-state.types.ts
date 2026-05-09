import type { UiFeedbackAction } from "@/lib/ui/action.types";

// Display states model stable empty/error surfaces. Keep message/title local to this
// contract; only the optional label/callback action primitive is shared with toasts.
export type UiDisplayStateAction = UiFeedbackAction;

export type UiDisplayState = {
  message: string;
  title?: string;
  action?: UiDisplayStateAction;
};
