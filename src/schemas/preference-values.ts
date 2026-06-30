import { i18nResourceLocales } from "@/lib/i18n-resources";
import {
  getDefaultShortcutPreferenceValue,
  isLockedShortcutPreferenceKey,
  isShortcutPreferenceKey,
  type KeyboardShortcutPrefs,
  type ShortcutPreferenceKey,
  shortcutDefaults,
} from "@/lib/keyboard/keyboard-shortcuts";

export { isShortcutPreferenceKey } from "@/lib/keyboard/keyboard-shortcuts";

export const themePreferenceValues = ["light", "dark", "system"] as const;
export type Theme = (typeof themePreferenceValues)[number];
export const languagePreferenceValues = ["system", ...i18nResourceLocales] as const;
export type LanguagePreference = (typeof languagePreferenceValues)[number];
export const unreadBadgePreferenceValues = ["dont_display", "all_unread", "only_inbox"] as const;
export type UnreadBadgePreference = (typeof unreadBadgePreferenceValues)[number];
export const openLinksPreferenceValues = ["in_app", "default_browser"] as const;
export const booleanStringPreferenceValues = ["true", "false"] as const;
export const sortOrderPreferenceValues = ["newest_first", "oldest_first"] as const;
export const groupByPreferenceValues = ["date", "feed", "none"] as const;
export const listSelectionStylePreferenceValues = ["modern", "classic"] as const;
export const sidebarDensityPreferenceValues = ["compact", "normal", "spacious"] as const;
export type SidebarDensityPreference = (typeof sidebarDensityPreferenceValues)[number];
export const layoutPreferenceValues = ["automatic", "wide", "compact"] as const;
export const fontStylePreferenceValues = ["sans_serif", "serif", "monospace"] as const;
export type FontStylePreference = (typeof fontStylePreferenceValues)[number];
export const fontSizePreferenceValues = ["small", "medium", "large"] as const;
export type FontSizePreference = (typeof fontSizePreferenceValues)[number];
export const imagePreviewsPreferenceValues = ["off", "small", "medium", "large"] as const;
export const afterReadingPreferenceValues = ["never", "immediately", "after_0_3s", "after_0_5s", "after_1s"] as const;
export type AfterReadingPreference = (typeof afterReadingPreferenceValues)[number];
export const sortSubscriptionsPreferenceValues = [
  "folders_first",
  "alphabetical",
  "newest_first",
  "oldest_first",
] as const;
export type SortSubscriptions = (typeof sortSubscriptionsPreferenceValues)[number];
export const startupFolderExpansionPreferenceValues = ["all_collapsed", "unread_folders", "restore_previous"] as const;
export type StartupFolderExpansionPreference = (typeof startupFolderExpansionPreferenceValues)[number];
export const developerModePreferenceValues = booleanStringPreferenceValues;
export const debugAgentationVisibilityPreferenceValues = ["always", "hide_in_settings", "off"] as const;
export type DebugAgentationVisibilityPreference = Exclude<
  (typeof debugAgentationVisibilityPreferenceValues)[number],
  "hide_in_settings"
>;

export const preferenceKeyMaxLength = 128;
export const preferenceValueMaxUtf8Bytes = 1024;
export const reservedUnknownPreferenceKeyPrefixes = ["shortcut_"] as const;
const textEncoder = new TextEncoder();
const objectHasOwnProperty = Object.prototype.hasOwnProperty;

type PreferenceValueMap = {
  language: LanguagePreference;
  unread_badge: UnreadBadgePreference;
  open_links: (typeof openLinksPreferenceValues)[number];
  open_links_background: (typeof booleanStringPreferenceValues)[number];
  sort_unread: (typeof sortOrderPreferenceValues)[number];
  group_by: (typeof groupByPreferenceValues)[number];
  cmd_click_browser: (typeof booleanStringPreferenceValues)[number];
  ask_before_mark_all: (typeof booleanStringPreferenceValues)[number];
  list_selection_style: (typeof listSelectionStylePreferenceValues)[number];
  sidebar_density: SidebarDensityPreference;
  layout: (typeof layoutPreferenceValues)[number];
  theme: Theme;
  opaque_sidebars: (typeof booleanStringPreferenceValues)[number];
  grayscale_favicons: (typeof booleanStringPreferenceValues)[number];
  font_style: FontStylePreference;
  font_size: FontSizePreference;
  show_starred_count: (typeof booleanStringPreferenceValues)[number];
  show_unread_count: (typeof booleanStringPreferenceValues)[number];
  show_sidebar_unread: (typeof booleanStringPreferenceValues)[number];
  show_sidebar_starred: (typeof booleanStringPreferenceValues)[number];
  show_sidebar_recent_articles: (typeof booleanStringPreferenceValues)[number];
  show_sidebar_tags: (typeof booleanStringPreferenceValues)[number];
  startup_folder_expansion: StartupFolderExpansionPreference;
  image_previews: (typeof imagePreviewsPreferenceValues)[number];
  display_favicons: (typeof booleanStringPreferenceValues)[number];
  text_preview: (typeof booleanStringPreferenceValues)[number];
  dim_archived: (typeof booleanStringPreferenceValues)[number];
  reader_mode_default: (typeof booleanStringPreferenceValues)[number];
  web_preview_mode_default: (typeof booleanStringPreferenceValues)[number];
  web_preview_keep_focus: (typeof booleanStringPreferenceValues)[number];
  window_always_on_top: (typeof booleanStringPreferenceValues)[number];
  reading_sort: (typeof sortOrderPreferenceValues)[number];
  after_reading: AfterReadingPreference;
  scroll_to_top_on_change: (typeof booleanStringPreferenceValues)[number];
  open_first_article_on_feed_selection: (typeof booleanStringPreferenceValues)[number];
  recent_articles_history_enabled: (typeof booleanStringPreferenceValues)[number];
  sort_subscriptions: SortSubscriptions;
  sync_on_startup: (typeof booleanStringPreferenceValues)[number];
  developer_mode: (typeof developerModePreferenceValues)[number];
  action_copy_link: (typeof booleanStringPreferenceValues)[number];
  action_open_browser: (typeof booleanStringPreferenceValues)[number];
  debug_browser_hud: (typeof booleanStringPreferenceValues)[number];
  debug_web_preview_url: string;
  debug_agentation_visibility: DebugAgentationVisibilityPreference;
  mute_auto_mark_read: (typeof booleanStringPreferenceValues)[number];
};

export type KnownPreferenceKey = keyof PreferenceValueMap;
export type PreferenceWritableKey = KnownPreferenceKey | ShortcutPreferenceKey | "selected_account_id";
type KnownPreferenceRecord = Partial<{
  [K in KnownPreferenceKey]: string;
}>;
type ShortcutPreferenceRecord = KeyboardShortcutPrefs;
type BackendPassthroughPreferenceRecord = {
  [K in string]: string;
};
export type PreferenceRecord = KnownPreferenceRecord & ShortcutPreferenceRecord & BackendPassthroughPreferenceRecord;
type PreferenceValue<K extends KnownPreferenceKey> = PreferenceValueMap[K];

export const backendOwnedPreferenceKeys = ["selected_account_id", "startup_remote_state_repair_v1"] as const;
const retiredBackendPassthroughPreferenceKeys = [] as const;
const retiredBackendPassthroughPreferenceKeySet: ReadonlySet<string> = new Set(retiredBackendPassthroughPreferenceKeys);
const preferenceTypoDetectionDistance = 2;

const knownPreferenceKeys = [
  "language",
  "unread_badge",
  "open_links",
  "open_links_background",
  "sort_unread",
  "group_by",
  "cmd_click_browser",
  "ask_before_mark_all",
  "list_selection_style",
  "sidebar_density",
  "layout",
  "theme",
  "opaque_sidebars",
  "grayscale_favicons",
  "font_style",
  "font_size",
  "show_starred_count",
  "show_unread_count",
  "show_sidebar_unread",
  "show_sidebar_starred",
  "show_sidebar_recent_articles",
  "show_sidebar_tags",
  "startup_folder_expansion",
  "image_previews",
  "display_favicons",
  "text_preview",
  "dim_archived",
  "reader_mode_default",
  "web_preview_mode_default",
  "web_preview_keep_focus",
  "window_always_on_top",
  "reading_sort",
  "after_reading",
  "scroll_to_top_on_change",
  "open_first_article_on_feed_selection",
  "recent_articles_history_enabled",
  "sort_subscriptions",
  "sync_on_startup",
  "developer_mode",
  "action_copy_link",
  "action_open_browser",
  "debug_browser_hud",
  "debug_web_preview_url",
  "debug_agentation_visibility",
  "mute_auto_mark_read",
] as const satisfies readonly KnownPreferenceKey[];
const knownPreferenceKeySet: ReadonlySet<string> = new Set(knownPreferenceKeys);

export const hiddenPreferenceDefaultKeys = [
  "recent_articles_history_enabled",
  "sort_subscriptions",
  "action_open_browser",
] as const satisfies readonly KnownPreferenceKey[];
export type HiddenPreferenceKey = (typeof hiddenPreferenceDefaultKeys)[number];
export type VisiblePreferenceDefaultKey = Exclude<KnownPreferenceKey, HiddenPreferenceKey> | ShortcutPreferenceKey;
export type PreferenceDefaultsRecord = Partial<Record<VisiblePreferenceDefaultKey, string>>;

const hiddenPreferenceDefaultKeySet = new Set<string>(hiddenPreferenceDefaultKeys);

function isHiddenPreferenceKey(key: string): key is HiddenPreferenceKey {
  return hiddenPreferenceDefaultKeySet.has(key);
}

function isVisiblePreferenceDefaultKey(key: string): key is VisiblePreferenceDefaultKey {
  return (isKnownPreferenceKey(key) && !isHiddenPreferenceKey(key)) || isShortcutPreferenceKey(key);
}

function resolveVisiblePreferenceDefault(key: string): string | undefined {
  return isVisiblePreferenceDefaultKey(key) ? preferenceDefaults[key] : undefined;
}

const legacyAfterReadingValueMap: Record<string, AfterReadingPreference> = {
  mark_as_read: "immediately",
  do_nothing: "never",
  archive: "never",
};

export const corePreferenceDefaults = {
  language: "system",
  unread_badge: "dont_display",
  open_links: "in_app",
  open_links_background: "false",
  sort_unread: "newest_first",
  group_by: "date",
  cmd_click_browser: "false",
  ask_before_mark_all: "true",
  list_selection_style: "modern",
  sidebar_density: "normal",
  layout: "automatic",
  theme: "light",
  opaque_sidebars: "false",
  grayscale_favicons: "false",
  font_style: "sans_serif",
  font_size: "medium",
  show_starred_count: "true",
  show_unread_count: "true",
  show_sidebar_unread: "true",
  show_sidebar_starred: "true",
  show_sidebar_recent_articles: "true",
  show_sidebar_tags: "true",
  startup_folder_expansion: "all_collapsed",
  image_previews: "medium",
  display_favicons: "true",
  text_preview: "true",
  dim_archived: "true",
  reader_mode_default: "true",
  web_preview_mode_default: "false",
  web_preview_keep_focus: "false",
  window_always_on_top: "false",
  reading_sort: "newest_first",
  after_reading: "after_0_3s",
  scroll_to_top_on_change: "true",
  open_first_article_on_feed_selection: "false",
  recent_articles_history_enabled: "true",
  sort_subscriptions: "folders_first",
  sync_on_startup: "true",
  developer_mode: "false",
  action_copy_link: "true",
  action_open_browser: "true",
  debug_browser_hud: "false",
  debug_web_preview_url: "",
  debug_agentation_visibility: "always",
  mute_auto_mark_read: "false",
} as const satisfies {
  [K in KnownPreferenceKey]: PreferenceValueMap[K];
};

const hiddenPreferenceDefaults: Record<HiddenPreferenceKey, string> = {
  action_open_browser: corePreferenceDefaults.action_open_browser,
  recent_articles_history_enabled: corePreferenceDefaults.recent_articles_history_enabled,
  sort_subscriptions: corePreferenceDefaults.sort_subscriptions,
};

export function isKnownPreferenceKey(key: string): key is KnownPreferenceKey {
  return knownPreferenceKeySet.has(key);
}

export function isBackendOwnedPreferenceKey(key: string): key is (typeof backendOwnedPreferenceKeys)[number] {
  return backendOwnedPreferenceKeys.some((backendOwnedKey) => backendOwnedKey === key);
}

const preferenceTypoDetectionCandidateKeys = [
  ...knownPreferenceKeys,
  ...Object.keys(shortcutDefaults),
  ...backendOwnedPreferenceKeys,
] as const;

function getEditDistanceWithinLimit(source: string, target: string, limit: number): number {
  if (Math.abs(source.length - target.length) > limit) {
    return limit + 1;
  }

  let previousRow = Array.from({ length: target.length + 1 }, (_value, index) => index);
  for (let sourceIndex = 0; sourceIndex < source.length; sourceIndex += 1) {
    const currentRow = [sourceIndex + 1];
    let rowMinimum = currentRow[0] ?? limit + 1;
    for (let targetIndex = 0; targetIndex < target.length; targetIndex += 1) {
      const substitutionCost = source[sourceIndex] === target[targetIndex] ? 0 : 1;
      const insertionCost = (currentRow[targetIndex] ?? limit + 1) + 1;
      const deletionCost = (previousRow[targetIndex + 1] ?? limit + 1) + 1;
      const substitution = (previousRow[targetIndex] ?? limit + 1) + substitutionCost;
      const distance = Math.min(insertionCost, deletionCost, substitution);
      currentRow.push(distance);
      rowMinimum = Math.min(rowMinimum, distance);
    }

    if (rowMinimum > limit) {
      return limit + 1;
    }
    previousRow = currentRow;
  }

  return previousRow[target.length] ?? limit + 1;
}

export function getLikelyPreferenceKeyTypo(key: string): string | null {
  if (isKnownPreferenceKey(key) || isShortcutPreferenceKey(key) || isBackendOwnedPreferenceKey(key)) {
    return null;
  }
  if (key.length > preferenceKeyMaxLength) {
    return null;
  }

  let likelyCandidate: string | null = null;
  let likelyCandidateDistance = preferenceTypoDetectionDistance + 1;
  for (const candidate of preferenceTypoDetectionCandidateKeys) {
    const distance = getEditDistanceWithinLimit(key, candidate, preferenceTypoDetectionDistance);
    if (distance < likelyCandidateDistance) {
      likelyCandidate = candidate;
      likelyCandidateDistance = distance;
    }
  }

  return likelyCandidateDistance <= preferenceTypoDetectionDistance ? likelyCandidate : null;
}

export function isRetiredBackendPassthroughPreferenceKey(key: string): boolean {
  return retiredBackendPassthroughPreferenceKeySet.has(key);
}

export function isReservedUnknownPreferenceKey(key: string): boolean {
  if (isKnownPreferenceKey(key) || isShortcutPreferenceKey(key) || isBackendOwnedPreferenceKey(key)) {
    return false;
  }

  return reservedUnknownPreferenceKeyPrefixes.some((prefix) => key.startsWith(prefix));
}

function buildVisibleCorePreferenceDefaults(): Partial<Record<VisiblePreferenceDefaultKey, string>> {
  const defaults: Partial<Record<VisiblePreferenceDefaultKey, string>> = {};
  for (const [key, value] of Object.entries(corePreferenceDefaults)) {
    if (isKnownPreferenceKey(key) && !isHiddenPreferenceKey(key)) {
      defaults[key] = value;
    }
  }
  return defaults;
}

export const preferenceDefaults: PreferenceDefaultsRecord = {
  ...buildVisibleCorePreferenceDefaults(),
  ...shortcutDefaults,
};

function hasControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0);
    return codePoint !== undefined && ((codePoint >= 0 && codePoint <= 31) || (codePoint >= 127 && codePoint <= 159));
  });
}

function isUtf8ByteLimitedString(value: string, maxBytes: number): boolean {
  return !hasControlCharacter(value) && textEncoder.encode(value).length <= maxBytes;
}

function parseKnownPreferenceValue<K extends KnownPreferenceKey>(key: K, value: string): PreferenceValue<K> | null {
  switch (key) {
    case "language":
      return languagePreferenceValues.includes(value as LanguagePreference) ? (value as PreferenceValue<K>) : null;
    case "unread_badge":
      return unreadBadgePreferenceValues.includes(value as UnreadBadgePreference)
        ? (value as PreferenceValue<K>)
        : null;
    case "open_links":
      return openLinksPreferenceValues.includes(value as PreferenceValue<"open_links">)
        ? (value as PreferenceValue<K>)
        : null;
    case "open_links_background":
    case "cmd_click_browser":
    case "ask_before_mark_all":
    case "opaque_sidebars":
    case "grayscale_favicons":
    case "show_starred_count":
    case "show_unread_count":
    case "show_sidebar_unread":
    case "show_sidebar_starred":
    case "show_sidebar_recent_articles":
    case "show_sidebar_tags":
    case "display_favicons":
    case "text_preview":
    case "dim_archived":
    case "reader_mode_default":
    case "web_preview_mode_default":
    case "web_preview_keep_focus":
    case "window_always_on_top":
    case "scroll_to_top_on_change":
    case "open_first_article_on_feed_selection":
    case "recent_articles_history_enabled":
    case "sync_on_startup":
    case "developer_mode":
    case "action_copy_link":
    case "action_open_browser":
    case "debug_browser_hud":
    case "mute_auto_mark_read":
      return booleanStringPreferenceValues.includes(value as PreferenceValue<"debug_browser_hud">)
        ? (value as PreferenceValue<K>)
        : null;
    case "sort_unread":
    case "reading_sort":
      return sortOrderPreferenceValues.includes(value as PreferenceValue<"sort_unread">)
        ? (value as PreferenceValue<K>)
        : null;
    case "group_by":
      return groupByPreferenceValues.includes(value as PreferenceValue<"group_by">)
        ? (value as PreferenceValue<K>)
        : null;
    case "list_selection_style":
      return listSelectionStylePreferenceValues.includes(value as PreferenceValue<"list_selection_style">)
        ? (value as PreferenceValue<K>)
        : null;
    case "sidebar_density":
      return sidebarDensityPreferenceValues.includes(value as SidebarDensityPreference)
        ? (value as PreferenceValue<K>)
        : null;
    case "layout":
      return layoutPreferenceValues.includes(value as PreferenceValue<"layout">) ? (value as PreferenceValue<K>) : null;
    case "theme":
      return themePreferenceValues.includes(value as Theme) ? (value as PreferenceValue<K>) : null;
    case "font_style":
      return fontStylePreferenceValues.includes(value as FontStylePreference) ? (value as PreferenceValue<K>) : null;
    case "font_size":
      return fontSizePreferenceValues.includes(value as FontSizePreference) ? (value as PreferenceValue<K>) : null;
    case "startup_folder_expansion":
      return startupFolderExpansionPreferenceValues.includes(value as StartupFolderExpansionPreference)
        ? (value as PreferenceValue<K>)
        : null;
    case "image_previews":
      return imagePreviewsPreferenceValues.includes(value as PreferenceValue<"image_previews">)
        ? (value as PreferenceValue<K>)
        : null;
    case "after_reading":
      return afterReadingPreferenceValues.includes(value as AfterReadingPreference)
        ? (value as PreferenceValue<K>)
        : null;
    case "sort_subscriptions":
      return sortSubscriptionsPreferenceValues.includes(value as SortSubscriptions)
        ? (value as PreferenceValue<K>)
        : null;
    case "debug_web_preview_url":
      return isUtf8ByteLimitedString(value, preferenceValueMaxUtf8Bytes) ? (value as PreferenceValue<K>) : null;
    case "debug_agentation_visibility":
      if (value === "hide_in_settings") {
        return "always" as PreferenceValue<K>;
      }
      return debugAgentationVisibilityPreferenceValues.includes(value as DebugAgentationVisibilityPreference)
        ? (value as PreferenceValue<K>)
        : null;
  }
}

function normalizeShortcutPreferenceValue(key: ShortcutPreferenceKey, value: string): string {
  if (isLockedShortcutPreferenceKey(key)) {
    return getDefaultShortcutPreferenceValue(key);
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 && isUtf8ByteLimitedString(trimmedValue, 128)
    ? trimmedValue
    : (preferenceDefaults[key] ?? "");
}

function normalizeBackendOwnedPreferenceValue(value: string): string {
  const trimmedValue = value.trim();
  return trimmedValue.length > 0 && trimmedValue.length <= 256 && !hasControlCharacter(trimmedValue)
    ? trimmedValue
    : "";
}

export function normalizePreferenceValue<K extends KnownPreferenceKey>(key: K, value: string): PreferenceValue<K>;
export function normalizePreferenceValue(key: string, value: string): string;
export function normalizePreferenceValue(key: string, value: string): string {
  if (isShortcutPreferenceKey(key)) {
    return normalizeShortcutPreferenceValue(key, value);
  }

  if (isBackendOwnedPreferenceKey(key)) {
    return normalizeBackendOwnedPreferenceValue(value);
  }

  if (!isKnownPreferenceKey(key)) {
    return value;
  }

  const resolvedValue =
    key === "after_reading" && objectHasOwnProperty.call(legacyAfterReadingValueMap, value)
      ? legacyAfterReadingValueMap[value]
      : value;

  const parsedValue = parseKnownPreferenceValue(key, resolvedValue);
  if (parsedValue !== null) {
    return parsedValue;
  }

  const parsedDefault = parseKnownPreferenceValue(key, corePreferenceDefaults[key]);
  return parsedDefault ?? "";
}

export function isValidPreferenceValue(key: string, value: string): boolean {
  if (isShortcutPreferenceKey(key)) {
    const trimmedValue = value.trim();
    return !hasControlCharacter(value) && trimmedValue.length > 0 && textEncoder.encode(trimmedValue).length <= 128;
  }

  if (isBackendOwnedPreferenceKey(key)) {
    const trimmedValue = value.trim();
    return trimmedValue.length > 0 && trimmedValue.length <= 256 && !hasControlCharacter(value);
  }

  if (!isKnownPreferenceKey(key)) {
    return true;
  }

  return parseKnownPreferenceValue(key, value) !== null;
}

export function normalizePreferenceRecord(prefs: PreferenceRecord): PreferenceRecord {
  const normalizedPrefs: Record<string, string> = Object.create(null);
  for (const [key, value] of Object.entries(prefs)) {
    Object.defineProperty(normalizedPrefs, key, {
      configurable: true,
      enumerable: true,
      value: normalizePreferenceValue(key, value),
      writable: true,
    });
  }
  return normalizedPrefs;
}

export function parseThemePreference(value: string): Theme | null {
  return themePreferenceValues.includes(value as Theme) ? (value as Theme) : null;
}

export function parseLanguagePreference(value: string): LanguagePreference {
  return normalizePreferenceValue("language", value);
}

export function resolvePreferenceValue<K extends KnownPreferenceKey>(
  prefs: PreferenceRecord,
  key: K,
): PreferenceValue<K>;
export function resolvePreferenceValue(prefs: PreferenceRecord, key: string): string;
export function resolvePreferenceValue(prefs: PreferenceRecord, key: string): string {
  let fallbackValue: string | undefined;
  if (isHiddenPreferenceKey(key)) {
    fallbackValue = hiddenPreferenceDefaults[key];
  } else {
    fallbackValue = resolveVisiblePreferenceDefault(key);
  }
  const rawValue: string =
    key === "reading_sort" && objectHasOwnProperty.call(prefs, "reading_sort")
      ? (prefs.reading_sort ?? "")
      : key === "reading_sort"
        ? (prefs.sort_unread ?? fallbackValue ?? "")
        : (prefs[key] ?? fallbackValue ?? "");
  return normalizePreferenceValue(key, rawValue);
}
