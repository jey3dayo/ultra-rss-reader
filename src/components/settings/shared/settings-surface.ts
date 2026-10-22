export const SETTINGS_DIVIDER_CLASS = "border-[var(--settings-shell-divider-border)]";

export const SETTINGS_SECTION_BORDER_CLASS = "border-[var(--settings-shell-section-border)]";

export const SETTINGS_CONTROL_SURFACE_CLASS =
  "border-[var(--settings-shell-control-border)] shadow-[var(--settings-shell-control-shadow)]";

export const SETTINGS_CHANGED_CONTROL_CLASS = "border-[var(--settings-field-changed-border)]";

export const SETTINGS_INFO_SURFACE_CLASS =
  "rounded-md border border-[var(--settings-shell-section-border)] bg-surface-1/72 shadow-[var(--settings-shell-section-shadow)]";

export const SETTINGS_SHELL_SHADOW_CLASS = "shadow-[var(--settings-shell-shadow)]";

export const SETTINGS_DETAIL_MAX_WIDTH_CLASS = "max-w-[640px]";

// Offset from the detail column edge to the content inside its cards: body padding (p-5 sm:p-6),
// card border (1px) and flat SettingsSection padding (px-4 sm:px-5).
export const SETTINGS_CARD_CONTENT_INSET_CLASS = "px-[calc(1.25rem+1px+1rem)] sm:px-[calc(1.5rem+1px+1.25rem)]";

// Same inset plus the control rail padding (lg:pr-2) on the trailing side.
export const SETTINGS_CARD_CONTROLS_INSET_CLASS =
  "px-[calc(1.25rem+1px+1rem)] sm:px-[calc(1.5rem+1px+1.25rem)] lg:pr-[calc(1.5rem+1px+1.25rem+0.5rem)]";
