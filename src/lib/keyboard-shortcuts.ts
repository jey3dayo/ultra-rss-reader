import { Result } from "@praha/byethrow";

export const keyboardEvents = {
  toggleRead: "ultra-rss:toggle-read",
  toggleStar: "ultra-rss:toggle-star",
  openInAppBrowser: "ultra-rss:open-in-app-browser",
  openExternalBrowser: "ultra-rss:open-external-browser",
  markAllRead: "ultra-rss:mark-all-read",
  focusSearch: "ultra-rss:focus-search",
  copyLink: "ultra-rss:copy-link",
  addToReadingList: "ultra-rss:add-to-reading-list",
} as const;

type ContentMode = "empty" | "reader" | "browser" | "loading";
type ViewMode = "all" | "unread" | "starred";

export type KeyboardAction =
  | { type: "open-settings" }
  | { type: "emit"; eventName: (typeof keyboardEvents)[keyof typeof keyboardEvents] }
  | { type: "set-view-mode"; mode: ViewMode }
  | { type: "close-browser" }
  | { type: "clear-article" }
  | { type: "focus-sidebar" }
  | { type: "navigate-article"; direction: 1 | -1 }
  | { type: "noop" };

export type KeyboardActionSkipReason = "ignored_input" | "missing_selected_article" | "no_action";

/** All customizable shortcut action identifiers. */
export type ShortcutActionId =
  | "next_article"
  | "prev_article"
  | "focus_sidebar"
  | "toggle_read"
  | "toggle_star"
  | "open_in_app_browser"
  | "open_external_browser"
  | "mark_all_read"
  | "cycle_filter"
  | "search"
  | "close_or_clear"
  | "open_settings";

export type ShortcutLabelKey =
  | "shortcuts.next_article"
  | "shortcuts.prev_article"
  | "shortcuts.focus_sidebar"
  | "shortcuts.toggle_read"
  | "shortcuts.toggle_star"
  | "shortcuts.view_in_browser"
  | "shortcuts.open_external_browser"
  | "shortcuts.mark_all_read"
  | "shortcuts.cycle_filter"
  | "shortcuts.search"
  | "shortcuts.close_or_clear"
  | "shortcuts.open_settings";

export type ShortcutCategoryKey =
  | "shortcuts.category_navigation"
  | "shortcuts.category_actions"
  | "shortcuts.category_global";

export interface ShortcutDefinition {
  id: ShortcutActionId;
  labelKey: ShortcutLabelKey;
  categoryKey: ShortcutCategoryKey;
  defaultKey: string;
}

/** Default shortcut definitions. Order determines display order in settings. */
export const shortcutDefinitions: ShortcutDefinition[] = [
  {
    id: "next_article",
    labelKey: "shortcuts.next_article",
    categoryKey: "shortcuts.category_navigation",
    defaultKey: "j",
  },
  {
    id: "prev_article",
    labelKey: "shortcuts.prev_article",
    categoryKey: "shortcuts.category_navigation",
    defaultKey: "k",
  },
  {
    id: "focus_sidebar",
    labelKey: "shortcuts.focus_sidebar",
    categoryKey: "shortcuts.category_navigation",
    defaultKey: "u",
  },
  { id: "toggle_read", labelKey: "shortcuts.toggle_read", categoryKey: "shortcuts.category_actions", defaultKey: "m" },
  { id: "toggle_star", labelKey: "shortcuts.toggle_star", categoryKey: "shortcuts.category_actions", defaultKey: "s" },
  {
    id: "open_in_app_browser",
    labelKey: "shortcuts.view_in_browser",
    categoryKey: "shortcuts.category_actions",
    defaultKey: "v",
  },
  {
    id: "open_external_browser",
    labelKey: "shortcuts.open_external_browser",
    categoryKey: "shortcuts.category_actions",
    defaultKey: "b",
  },
  // sync_all and sync_current are excluded from UI -- not yet wired to actions
  {
    id: "mark_all_read",
    labelKey: "shortcuts.mark_all_read",
    categoryKey: "shortcuts.category_actions",
    defaultKey: "a",
  },
  {
    id: "cycle_filter",
    labelKey: "shortcuts.cycle_filter",
    categoryKey: "shortcuts.category_actions",
    defaultKey: "f",
  },
  { id: "search", labelKey: "shortcuts.search", categoryKey: "shortcuts.category_global", defaultKey: "/" },
  {
    id: "close_or_clear",
    labelKey: "shortcuts.close_or_clear",
    categoryKey: "shortcuts.category_global",
    defaultKey: "Escape",
  },
  {
    id: "open_settings",
    labelKey: "shortcuts.open_settings",
    categoryKey: "shortcuts.category_global",
    defaultKey: "\u2318,",
  },
];

/** Preference key prefix for shortcut overrides. */
export const shortcutPrefKey = (id: ShortcutActionId): string => `shortcut_${id}`;

/** All default shortcut preference entries (for preferences-store defaults). */
export const shortcutDefaults: Record<string, string> = Object.fromEntries(
  shortcutDefinitions.map((d) => [shortcutPrefKey(d.id), d.defaultKey]),
);

/** Build a reverse mapping: key string -> ShortcutActionId. */
export function buildKeyToActionMap(prefs: Record<string, string>): Map<string, ShortcutActionId> {
  const map = new Map<string, ShortcutActionId>();
  for (const def of shortcutDefinitions) {
    const key = prefs[shortcutPrefKey(def.id)] ?? def.defaultKey;
    map.set(key, def.id);
  }
  return map;
}

/** Normalize a KeyboardEvent into the key string format used in shortcut definitions. */
export function normalizeKeyFromEvent(e: {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
}): string {
  const parts: string[] = [];
  if (e.metaKey || e.ctrlKey) parts.push("\u2318");
  if (e.shiftKey && e.key !== "Shift") parts.push("Shift");
  parts.push(e.key.length === 1 && e.shiftKey ? e.key.toUpperCase() : e.key);
  return parts.join("+");
}

/** Display-friendly format: "Shift+R" -> "Shift + R", "⌘," -> "⌘ ," */
export function formatKeyForDisplay(key: string): string {
  return key.replace(/\+/g, " + ").replace(/\u2318\s*\+?\s*/g, "\u2318 ");
}

type KeyboardContext = {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  targetTag?: string | null;
  selectedArticleId: string | null;
  contentMode: ContentMode;
  viewMode: ViewMode;
  keyToAction?: Map<string, ShortcutActionId>;
};

function nextViewMode(current: ViewMode): ViewMode {
  const modes: ViewMode[] = ["all", "unread", "starred"];
  const currentIndex = modes.indexOf(current);
  return modes[(currentIndex + 1) % modes.length];
}

function isTextInputTarget(targetTag?: string | null): boolean {
  return targetTag === "INPUT" || targetTag === "TEXTAREA";
}

function resolveActionForId(
  actionId: ShortcutActionId,
  context: { selectedArticleId: string | null; contentMode: ContentMode; viewMode: ViewMode },
): Result.Result<KeyboardAction, KeyboardActionSkipReason> {
  switch (actionId) {
    case "open_settings":
      return Result.succeed({ type: "open-settings" });
    case "toggle_read":
      return context.selectedArticleId
        ? Result.succeed({ type: "emit", eventName: keyboardEvents.toggleRead })
        : Result.fail("missing_selected_article");
    case "toggle_star":
      return context.selectedArticleId
        ? Result.succeed({ type: "emit", eventName: keyboardEvents.toggleStar })
        : Result.fail("missing_selected_article");
    case "open_in_app_browser":
      return context.selectedArticleId
        ? Result.succeed({ type: "emit", eventName: keyboardEvents.openInAppBrowser })
        : Result.fail("missing_selected_article");
    case "open_external_browser":
      return context.selectedArticleId
        ? Result.succeed({ type: "emit", eventName: keyboardEvents.openExternalBrowser })
        : Result.fail("missing_selected_article");
    case "cycle_filter":
      return Result.succeed({ type: "set-view-mode", mode: nextViewMode(context.viewMode) });
    case "mark_all_read":
      return Result.succeed({ type: "emit", eventName: keyboardEvents.markAllRead });
    case "search":
      return Result.succeed({ type: "emit", eventName: keyboardEvents.focusSearch });
    case "close_or_clear":
      if (context.contentMode === "browser") return Result.succeed({ type: "close-browser" });
      if (context.selectedArticleId) return Result.succeed({ type: "clear-article" });
      return Result.fail("no_action");
    case "focus_sidebar":
      return Result.succeed({ type: "focus-sidebar" });
    case "next_article":
      return Result.succeed({ type: "navigate-article", direction: 1 });
    case "prev_article":
      return Result.succeed({ type: "navigate-article", direction: -1 });
  }
}

export function resolveKeyboardAction(
  context: KeyboardContext,
): Result.Result<KeyboardAction, KeyboardActionSkipReason> {
  const { key, metaKey, ctrlKey, shiftKey, targetTag, selectedArticleId, contentMode, viewMode, keyToAction } = context;

  const normalized = normalizeKeyFromEvent({ key, metaKey, ctrlKey, shiftKey });

  // Use custom mapping if provided, otherwise use defaults
  const map = keyToAction ?? buildKeyToActionMap({});

  // open_settings must work even in text inputs
  const settingsActionId = map.get(normalized);
  if (settingsActionId === "open_settings") {
    return Result.succeed({ type: "open-settings" });
  }
  // Also keep legacy check for ⌘, (always works regardless of mapping)
  if (key === "," && (metaKey || ctrlKey)) {
    return Result.succeed({ type: "open-settings" });
  }

  if (isTextInputTarget(targetTag)) {
    return Result.fail("ignored_input");
  }

  // Look up the plain key first, then the normalized (with modifiers) form
  const actionId = map.get(key) ?? map.get(normalized);
  if (actionId && actionId !== "open_settings") {
    return resolveActionForId(actionId, { selectedArticleId, contentMode, viewMode });
  }

  return Result.fail("no_action");
}
