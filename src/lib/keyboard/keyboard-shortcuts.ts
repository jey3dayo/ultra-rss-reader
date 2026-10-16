import { Result } from "@praha/byethrow";
import type { PlatformKind } from "@/constants/platform";
import { shouldIgnoreGlobalShortcutKeyboardEvent } from "@/lib/keyboard/global-shortcut-targets";
import type { KeyboardContext } from "./keyboard-action-mapping";
import { isTextInputTarget, resolveActionForId } from "./keyboard-action-mapping";
import type {
  KeyboardAction,
  KeyboardActionSkipReason,
  KeyToActionMap,
  ShortcutActionId,
  ShortcutDefinition,
  ShortcutPreferenceKey,
} from "./keyboard-shortcut-model";

export type { KeyToActionMap } from "./keyboard-shortcut-model";
export { keyboardEvents } from "./keyboard-shortcut-model";

import {
  formatKeyForDisplay,
  hasNonPrimaryModifier,
  normalizeKeyFromRuntimeEvent,
  normalizeShortcutMapKey,
} from "./shortcut-key-normalization";

export type {
  KeyboardAction,
  KeyboardActionSkipReason,
  ShortcutActionId,
  ShortcutCategoryKey,
  ShortcutDefinition,
  ShortcutLabelKey,
  ShortcutPreferenceKey,
} from "./keyboard-shortcut-model";
export {
  formatKeyAsNativeAccelerator,
  formatKeyForDisplay,
  normalizeRecordedShortcutKey,
} from "./shortcut-key-normalization";

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
    id: "scroll_article_down",
    labelKey: "shortcuts.scroll_article_down",
    categoryKey: "shortcuts.category_navigation",
    defaultKey: "Space",
  },
  {
    id: "scroll_article_up",
    labelKey: "shortcuts.scroll_article_up",
    categoryKey: "shortcuts.category_navigation",
    defaultKey: "Shift+Space",
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
const lockedShortcutActionIds = new Set<ShortcutActionId>(["open_settings"]);

function isShortcutActionId(value: string): value is ShortcutActionId {
  return shortcutActionIdSet.has(value);
}

export function isShortcutPreferenceKey(key: string): key is ShortcutPreferenceKey {
  return key.startsWith("shortcut_") && isShortcutActionId(key.slice("shortcut_".length));
}

export function isLockedShortcutActionId(id: ShortcutActionId): boolean {
  return lockedShortcutActionIds.has(id);
}

export function isLockedShortcutPreferenceKey(key: ShortcutPreferenceKey): boolean {
  return isLockedShortcutActionId(key.slice("shortcut_".length) as ShortcutActionId);
}

export function getDefaultShortcutKey(id: ShortcutActionId): string {
  return shortcutDefinitionById.get(id)?.defaultKey ?? "";
}

export function getDefaultShortcutPreferenceValue(key: ShortcutPreferenceKey): string {
  const actionId = key.slice("shortcut_".length);
  return isShortcutActionId(actionId) ? getDefaultShortcutKey(actionId) : "";
}

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
  if (isLockedShortcutActionId(id)) {
    return getDefaultShortcutKey(id);
  }

  const definition = shortcutDefinitionById.get(id);
  const preferenceKey = shortcutPrefKey(id);
  const renamedPreference = renamedShortcutPreferenceEntries.find(([, currentKey]) => currentKey === preferenceKey);

  return (
    prefs[preferenceKey] ??
    (renamedPreference ? prefs[renamedPreference[0]] : undefined) ??
    definition?.defaultKey ??
    ""
  );
}

function isNativeMenuOwnedShortcut(key: string): boolean {
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

  if (targetId === "open_settings" && normalizedKey === platformSettingsShortcut) {
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

export function getShortcutDisplay(
  id: ShortcutActionId,
  prefs: KeyboardShortcutPrefs,
  platformKind: PlatformKind,
): string {
  return formatKeyForDisplay(getShortcutKey(id, prefs), platformKind);
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
    keyCode,
    targetTag,
    targetIsTextEditing,
    targetIsNativeActivation,
    selectedArticleId,
    contentMode,
    viewMode,
    subscriptionsWorkspaceOpen,
    keyToAction,
    platformKind = "macos",
  } = context;

  if (shouldIgnoreGlobalShortcutKeyboardEvent({ key, altKey, isComposing, keyCode })) {
    return Result.fail("no_action");
  }

  const runtimeEvent = { key, metaKey, ctrlKey, shiftKey };
  const normalized = normalizeKeyFromRuntimeEvent(runtimeEvent, platformKind);
  const normalizedActionKey = hasNonPrimaryModifier(platformKind, runtimeEvent)
    ? normalized
    : (normalizeShortcutMapKey(normalized) ?? normalized);

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
  if ((actionId === "scroll_article_down" || actionId === "scroll_article_up") && targetIsNativeActivation) {
    return Result.fail("no_action");
  }

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
