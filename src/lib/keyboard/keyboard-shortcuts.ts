import { Result } from "@praha/byethrow";
import { type PlatformKind, SHORTCUT_MODIFIER_BY_PLATFORM } from "@/constants/platform";
import { shouldIgnoreGlobalShortcutKeyboardEvent } from "@/lib/keyboard/global-shortcut-targets";
import type { ContentMode } from "@/lib/layout/layout-state.types";
import type { ViewMode } from "@/lib/reader/view-mode.types";

export const keyboardEvents = {
  toggleRead: "ultra-rss:toggle-read",
  toggleStar: "ultra-rss:toggle-star",
  openInAppBrowser: "ultra-rss:open-in-app-browser",
  openExternalBrowser: "ultra-rss:open-external-browser",
  closeBrowserOverlay: "ultra-rss:close-browser-overlay",
  markAllRead: "ultra-rss:mark-all-read",
  focusSearch: "ultra-rss:focus-search",
  copyLink: "ultra-rss:copy-link",
  addToReadingList: "ultra-rss:add-to-reading-list",
} as const;

export type KeyboardAction =
  | { type: "open-settings" }
  | { type: "open-command-palette" }
  | { type: "open-shortcuts-help" }
  | { type: "restart-app" }
  | {
      type: "emit";
      eventName: (typeof keyboardEvents)[keyof typeof keyboardEvents];
    }
  | { type: "set-view-mode"; mode: ViewMode }
  | { type: "toggle-sidebar" }
  | { type: "close-browser" }
  | { type: "clear-article" }
  | { type: "focus-sidebar" }
  | { type: "navigate-article"; direction: 1 | -1 }
  | { type: "navigate-feed"; direction: 1 | -1 }
  | { type: "reload-webview" }
  | { type: "noop" };

export type KeyboardActionSkipReason = "ignored_input" | "missing_selected_article" | "no_action";

/** All customizable shortcut action identifiers. */
export type ShortcutActionId =
  | "next_article"
  | "prev_article"
  | "next_feed"
  | "prev_feed"
  | "reload_webview"
  | "focus_sidebar"
  | "toggle_sidebar"
  | "toggle_read"
  | "toggle_star"
  | "open_in_app_browser"
  | "open_external_browser"
  | "mark_all_read"
  | "show_unread"
  | "show_all"
  | "show_starred"
  | "cycle_filter"
  | "search"
  | "close_or_clear"
  | "open_command_palette"
  | "open_settings";

export type ShortcutPreferenceKey = `shortcut_${ShortcutActionId}`;

export type ShortcutLabelKey =
  | "shortcuts.next_article"
  | "shortcuts.prev_article"
  | "shortcuts.next_feed"
  | "shortcuts.prev_feed"
  | "shortcuts.reload_webview"
  | "shortcuts.focus_sidebar"
  | "shortcuts.toggle_sidebar"
  | "shortcuts.toggle_read"
  | "shortcuts.toggle_star"
  | "shortcuts.view_in_browser"
  | "shortcuts.open_external_browser"
  | "shortcuts.mark_all_read"
  | "shortcuts.show_unread"
  | "shortcuts.show_all"
  | "shortcuts.show_starred"
  | "shortcuts.cycle_filter"
  | "shortcuts.search"
  | "shortcuts.close_or_clear"
  | "shortcuts.open_command_palette"
  | "shortcuts.open_settings";

export type ShortcutCategoryKey =
  | "shortcuts.category_navigation"
  | "shortcuts.category_actions"
  | "shortcuts.category_global";

export type ShortcutDefinition = {
  id: ShortcutActionId;
  labelKey: ShortcutLabelKey;
  categoryKey: ShortcutCategoryKey;
  defaultKey: string;
};

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
    id: "next_feed",
    labelKey: "shortcuts.next_feed",
    categoryKey: "shortcuts.category_navigation",
    defaultKey: "l",
  },
  {
    id: "prev_feed",
    labelKey: "shortcuts.prev_feed",
    categoryKey: "shortcuts.category_navigation",
    defaultKey: "h",
  },
  {
    id: "reload_webview",
    labelKey: "shortcuts.reload_webview",
    categoryKey: "shortcuts.category_actions",
    defaultKey: "r",
  },
  {
    id: "focus_sidebar",
    labelKey: "shortcuts.focus_sidebar",
    categoryKey: "shortcuts.category_navigation",
    defaultKey: "u",
  },
  {
    id: "toggle_sidebar",
    labelKey: "shortcuts.toggle_sidebar",
    categoryKey: "shortcuts.category_navigation",
    defaultKey: "⌘+\\",
  },
  {
    id: "toggle_read",
    labelKey: "shortcuts.toggle_read",
    categoryKey: "shortcuts.category_actions",
    defaultKey: "m",
  },
  {
    id: "toggle_star",
    labelKey: "shortcuts.toggle_star",
    categoryKey: "shortcuts.category_actions",
    defaultKey: "s",
  },
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
    id: "show_unread",
    labelKey: "shortcuts.show_unread",
    categoryKey: "shortcuts.category_actions",
    defaultKey: "⌘+1",
  },
  {
    id: "show_all",
    labelKey: "shortcuts.show_all",
    categoryKey: "shortcuts.category_actions",
    defaultKey: "⌘+2",
  },
  {
    id: "show_starred",
    labelKey: "shortcuts.show_starred",
    categoryKey: "shortcuts.category_actions",
    defaultKey: "⌘+3",
  },
  {
    id: "cycle_filter",
    labelKey: "shortcuts.cycle_filter",
    categoryKey: "shortcuts.category_actions",
    defaultKey: "f",
  },
  {
    id: "search",
    labelKey: "shortcuts.search",
    categoryKey: "shortcuts.category_global",
    defaultKey: "/",
  },
  {
    id: "open_command_palette",
    labelKey: "shortcuts.open_command_palette",
    categoryKey: "shortcuts.category_global",
    defaultKey: "\u2318+k",
  },
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
export const shortcutPrefKey = (id: ShortcutActionId): ShortcutPreferenceKey => `shortcut_${id}`;

const shortcutDefinitionById = new Map<ShortcutActionId, ShortcutDefinition>(
  shortcutDefinitions.map((definition) => [definition.id, definition]),
);
const shortcutActionIdSet = new Set<string>(shortcutDefinitionById.keys());

export function isShortcutActionId(value: string): value is ShortcutActionId {
  return shortcutActionIdSet.has(value);
}

export function isShortcutPreferenceKey(key: string): key is ShortcutPreferenceKey {
  return key.startsWith("shortcut_") && isShortcutActionId(key.slice("shortcut_".length));
}

export type KeyToActionMap = Map<string, ShortcutActionId>;
export type ShortcutConflict =
  | {
      type: "duplicate";
      actionId: ShortcutActionId;
    }
  | {
      type: "native_menu";
    }
  | {
      type: "shortcuts_help";
    };

const platformSettingsShortcut = "\u2318+,";
const nativeMenuOwnedShortcuts = new Set(["\u2318+r", platformSettingsShortcut]);
const renamedShortcutPreferenceEntries = [
  ["shortcut_view_in_browser", "shortcut_open_in_app_browser"],
  ["shortcut_open_browser", "shortcut_open_external_browser"],
] as const satisfies readonly (readonly [string, ShortcutPreferenceKey])[];
type RenamedShortcutPreferenceKey = (typeof renamedShortcutPreferenceEntries)[number][0];

export type KeyboardShortcutPrefs = Partial<Record<ShortcutPreferenceKey, string>> &
  Partial<Record<RenamedShortcutPreferenceKey, string>>;

export function getRenamedShortcutPreferenceKey(key: string): ShortcutPreferenceKey | null {
  return renamedShortcutPreferenceEntries.find(([legacyKey]) => legacyKey === key)?.[1] ?? null;
}

function getShortcutKey(id: ShortcutActionId, prefs: KeyboardShortcutPrefs): string {
  const definition = shortcutDefinitionById.get(id);
  if (id === "open_settings") {
    return definition?.defaultKey ?? "\u2318,";
  }

  const preferenceKey = shortcutPrefKey(id);
  const renamedPreference = renamedShortcutPreferenceEntries.find(([, currentKey]) => currentKey === preferenceKey);

  return (
    prefs[preferenceKey] ??
    (renamedPreference ? prefs[renamedPreference[0]] : undefined) ??
    definition?.defaultKey ??
    ""
  );
}

function normalizeModifierToken(token: string): string {
  return /^(?:cmdorctrl|command|cmd|control|ctrl)$/i.test(token) ? "\u2318" : token;
}

function normalizeShortcutKeyForContract(key: string): string {
  const compactKey = key.trim().replace(/\s*\+\s*/g, "+");
  if (compactKey.length === 0) {
    return "";
  }

  const parts =
    !compactKey.includes("+") && compactKey.startsWith("\u2318") && compactKey.length > 1
      ? ["\u2318", compactKey.slice(1)]
      : compactKey.includes("+")
        ? compactKey.split("+")
        : [compactKey];
  return parts
    .map((part) => {
      const normalizedPart = normalizeModifierToken(part);
      return normalizedPart.length === 1 && normalizedPart.toLocaleUpperCase() !== normalizedPart.toLocaleLowerCase()
        ? normalizedPart.toLocaleLowerCase()
        : normalizedPart;
    })
    .join("+");
}

function normalizeShortcutMapKey(key: string): string | null {
  const trimmedKey = key.trim();
  return trimmedKey.length > 0 ? normalizeShortcutKeyForContract(trimmedKey) : null;
}

export function normalizeRecordedShortcutKey(e: {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
}): string {
  return normalizeShortcutKeyForContract(normalizeKeyFromEvent(e));
}

export function isNativeMenuOwnedShortcut(key: string): boolean {
  const normalizedKey = normalizeShortcutMapKey(key);
  return normalizedKey !== null && nativeMenuOwnedShortcuts.has(normalizedKey);
}

export function getShortcutConflict(
  targetId: ShortcutActionId,
  key: string,
  prefs: KeyboardShortcutPrefs,
): ShortcutConflict | null {
  const normalizedKey = normalizeShortcutMapKey(key);
  if (normalizedKey === null) {
    return null;
  }

  if (isNativeMenuOwnedShortcut(normalizedKey)) {
    return { type: "native_menu" };
  }

  if (normalizedKey === "?" || normalizedKey === "Shift+?") {
    return { type: "shortcuts_help" };
  }

  for (const definition of shortcutDefinitions) {
    if (definition.id === targetId) {
      continue;
    }

    if (normalizeShortcutMapKey(getShortcutKey(definition.id, prefs)) === normalizedKey) {
      return { type: "duplicate", actionId: definition.id };
    }
  }

  return null;
}

/** All default shortcut preference entries (for preferences-store defaults). */
export const shortcutDefaults: KeyboardShortcutPrefs = {};
for (const definition of shortcutDefinitions) {
  shortcutDefaults[shortcutPrefKey(definition.id)] = definition.defaultKey;
}

/** Build a reverse mapping: key string -> ShortcutActionId. */
export function buildKeyToActionMap(prefs: KeyboardShortcutPrefs): KeyToActionMap {
  const map: KeyToActionMap = new Map();
  const keyCounts = new Map<string, number>();

  for (const definition of shortcutDefinitions) {
    const key = normalizeShortcutMapKey(getShortcutKey(definition.id, prefs));
    if (key !== null) {
      keyCounts.set(key, (keyCounts.get(key) ?? 0) + 1);
    }
  }

  for (const def of shortcutDefinitions) {
    const key = normalizeShortcutMapKey(getShortcutKey(def.id, prefs));
    if (key === null) {
      continue;
    }
    if ((keyCounts.get(key) ?? 0) > 1 || isNativeMenuOwnedShortcut(key)) {
      continue;
    }
    map.set(key, def.id);
  }
  return map;
}

/** Normalize a KeyboardEvent into the key string format used in shortcut definitions. */
function normalizeKeyFromEvent(e: { key: string; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean }): string {
  const parts: string[] = [];
  if (e.metaKey || e.ctrlKey) parts.push("\u2318");
  if (e.shiftKey && e.key !== "Shift") parts.push("Shift");
  parts.push(e.key.length === 1 && e.shiftKey ? e.key.toUpperCase() : e.key);
  return parts.join("+");
}

/** Display-friendly format: "Shift+R" -> "Shift + R", "⌘," -> "⌘ ," */
export function formatKeyForDisplay(key: string, platformKind: PlatformKind): string {
  const modifier = SHORTCUT_MODIFIER_BY_PLATFORM[platformKind];
  const normalized = key.replace(/\u2318/g, modifier).replace(/\+/g, " + ");
  const modifierPattern = platformKind === "macos" ? /\u2318\s*\+?\s*/g : /Ctrl\s*\+?\s*/g;
  return normalized.replace(modifierPattern, `${modifier} `);
}

export function formatKeyAsNativeAccelerator(key: string): string {
  return normalizeShortcutKeyForContract(key)
    .replace(/\u2318/g, "CmdOrCtrl")
    .split("+")
    .map((part) =>
      part.length === 1 && part.toLocaleUpperCase() !== part.toLocaleLowerCase() ? part.toUpperCase() : part,
    )
    .join("+");
}

export function getShortcutDisplay(
  id: ShortcutActionId,
  prefs: KeyboardShortcutPrefs,
  platformKind: PlatformKind,
): string {
  return formatKeyForDisplay(getShortcutKey(id, prefs), platformKind);
}

type KeyboardContext = {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey?: boolean;
  isComposing?: boolean;
  targetTag?: string | null;
  targetIsTextEditing?: boolean;
  selectedArticleId: string | null;
  contentMode: ContentMode;
  viewMode: ViewMode;
  subscriptionsWorkspaceOpen?: boolean;
  keyToAction?: KeyToActionMap;
};

function nextViewMode(current: ViewMode): ViewMode {
  const modes: ViewMode[] = ["all", "unread", "starred"];
  const currentIndex = modes.indexOf(current);
  return modes[(currentIndex + 1) % modes.length];
}

function isTextInputTarget(targetTag?: string | null, targetIsTextEditing = false): boolean {
  const normalizedTag = targetTag?.toUpperCase();
  return targetIsTextEditing || normalizedTag === "INPUT" || normalizedTag === "TEXTAREA";
}

function resolveActionForId(
  actionId: ShortcutActionId,
  context: {
    selectedArticleId: string | null;
    contentMode: ContentMode;
    viewMode: ViewMode;
    subscriptionsWorkspaceOpen?: boolean;
  },
): Result.Result<KeyboardAction, KeyboardActionSkipReason> {
  switch (actionId) {
    case "open_settings":
      return Result.succeed({ type: "open-settings" });
    case "open_command_palette":
      return Result.succeed({ type: "open-command-palette" });
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
        ? Result.succeed({
            type: "emit",
            eventName: keyboardEvents.openInAppBrowser,
          })
        : Result.fail("missing_selected_article");
    case "open_external_browser":
      return context.selectedArticleId
        ? Result.succeed({
            type: "emit",
            eventName: keyboardEvents.openExternalBrowser,
          })
        : Result.fail("missing_selected_article");
    case "cycle_filter":
      return Result.succeed({
        type: "set-view-mode",
        mode: nextViewMode(context.viewMode),
      });
    case "show_unread":
      return Result.succeed({ type: "set-view-mode", mode: "unread" });
    case "show_all":
      return Result.succeed({ type: "set-view-mode", mode: "all" });
    case "show_starred":
      return Result.succeed({ type: "set-view-mode", mode: "starred" });
    case "mark_all_read":
      return Result.succeed({
        type: "emit",
        eventName: keyboardEvents.markAllRead,
      });
    case "search":
      return Result.succeed({
        type: "emit",
        eventName: keyboardEvents.focusSearch,
      });
    case "close_or_clear":
      if (context.subscriptionsWorkspaceOpen) {
        return Result.fail("no_action");
      }
      if (context.contentMode === "browser") return Result.succeed({ type: "close-browser" });
      if (context.selectedArticleId) return Result.succeed({ type: "clear-article" });
      return Result.fail("no_action");
    case "focus_sidebar":
      return Result.succeed({ type: "focus-sidebar" });
    case "toggle_sidebar":
      return Result.succeed({ type: "toggle-sidebar" });
    case "next_article":
      return Result.succeed({ type: "navigate-article", direction: 1 });
    case "prev_article":
      return Result.succeed({ type: "navigate-article", direction: -1 });
    case "next_feed":
      return Result.succeed({ type: "navigate-feed", direction: 1 });
    case "prev_feed":
      return Result.succeed({ type: "navigate-feed", direction: -1 });
    case "reload_webview":
      return context.contentMode === "browser" ? Result.succeed({ type: "reload-webview" }) : Result.fail("no_action");
  }
}

export function resolveKeyboardAction(
  context: KeyboardContext,
): Result.Result<KeyboardAction, KeyboardActionSkipReason> {
  const {
    key,
    metaKey,
    ctrlKey,
    shiftKey,
    altKey,
    isComposing,
    targetTag,
    targetIsTextEditing,
    selectedArticleId,
    contentMode,
    viewMode,
    subscriptionsWorkspaceOpen,
    keyToAction,
  } = context;

  if (shouldIgnoreGlobalShortcutKeyboardEvent({ key, altKey, isComposing })) {
    return Result.fail("no_action");
  }

  const normalized = normalizeKeyFromEvent({ key, metaKey, ctrlKey, shiftKey });
  const normalizedActionKey = normalizeShortcutMapKey(normalized) ?? normalized;

  // Use custom mapping if provided, otherwise use defaults
  const map = keyToAction ?? buildKeyToActionMap({});

  const textInputTarget = isTextInputTarget(targetTag, targetIsTextEditing);

  // The platform settings shortcut is fixed to match the native menu accelerator and works in text inputs.
  if (normalizedActionKey === platformSettingsShortcut) {
    return Result.succeed({ type: "open-settings" });
  }

  const settingsActionId = map.get(normalizedActionKey);
  if (settingsActionId === "open_settings") {
    if (textInputTarget) {
      return Result.fail("ignored_input");
    }
    return Result.succeed({ type: "open-settings" });
  }

  if (nativeMenuOwnedShortcuts.has(normalizedActionKey)) {
    return Result.fail("no_action");
  }

  if (textInputTarget) {
    return Result.fail("ignored_input");
  }

  if (key === "?") {
    return Result.succeed({ type: "open-shortcuts-help" });
  }

  // Modifier shortcuts should not fall back to plain single-key bindings.
  const actionId = metaKey || ctrlKey ? map.get(normalizedActionKey) : (map.get(normalizedActionKey) ?? map.get(key));
  if (actionId && actionId !== "open_settings") {
    return resolveActionForId(actionId, {
      selectedArticleId,
      contentMode,
      viewMode,
      subscriptionsWorkspaceOpen,
    });
  }

  return Result.fail("no_action");
}
