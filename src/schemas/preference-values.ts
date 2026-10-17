import {
  getDefaultShortcutPreferenceValue,
  isLockedShortcutPreferenceKey,
  isShortcutPreferenceKey,
  type KeyboardShortcutPrefs,
  type ShortcutPreferenceKey,
  shortcutDefaults,
} from "@/lib/keyboard/keyboard-shortcuts";
import { getEditDistanceWithinLimit } from "@/lib/settings/preference-key-edit-distance";
import type {
  AfterReadingPreference,
  DebugAgentationVisibilityPreference,
  FontSizePreference,
  FontStylePreference,
  LanguagePreference,
  SidebarDensityPreference,
  SortSubscriptions,
  StartupFolderExpansionPreference,
  Theme,
  UnreadBadgePreference,
} from "@/lib/settings/preference-value-options";
import {
  afterReadingPreferenceValues,
  booleanStringPreferenceValues,
  debugAgentationVisibilityPreferenceValues,
  fontSizePreferenceValues,
  fontStylePreferenceValues,
  groupByPreferenceValues,
  imagePreviewsPreferenceValues,
  languagePreferenceValues,
  layoutPreferenceValues,
  listSelectionStylePreferenceValues,
  openLinksPreferenceValues,
  sidebarDensityPreferenceValues,
  sortOrderPreferenceValues,
  sortSubscriptionsPreferenceValues,
  startupFolderExpansionPreferenceValues,
  themePreferenceValues,
  unreadBadgePreferenceValues,
} from "@/lib/settings/preference-value-options";

export { isShortcutPreferenceKey } from "@/lib/keyboard/keyboard-shortcuts";
export * from "@/lib/settings/preference-value-options";

export const preferenceKeyMaxLength = 128;
export const preferenceValueMaxUtf8Bytes = 1024;
const reservedUnknownPreferenceKeyPrefixes = ["shortcut_"] as const;
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
  developer_mode: (typeof booleanStringPreferenceValues)[number];
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

const hiddenPreferenceDefaultKeys = [
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

// The serif (明朝体) font style was removed in v0.67.4. Saved values load as the default sans stack.
const legacyFontStyleValueMap: Record<string, FontStylePreference> = {
  serif: "sans_serif",
};

function resolveLegacyPreferenceValue(key: string, value: string): string {
  if (key === "after_reading" && objectHasOwnProperty.call(legacyAfterReadingValueMap, value)) {
    return legacyAfterReadingValueMap[value];
  }
  if (key === "font_style" && objectHasOwnProperty.call(legacyFontStyleValueMap, value)) {
    return legacyFontStyleValueMap[value];
  }
  return value;
}

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
  debug_web_preview_url: "https://news.yahoo.co.jp/",
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

type PicklistPreferenceKey = Exclude<KnownPreferenceKey, "debug_web_preview_url" | "debug_agentation_visibility">;

const picklistPreferenceValues: Record<PicklistPreferenceKey, readonly string[]> = {
  language: languagePreferenceValues,
  unread_badge: unreadBadgePreferenceValues,
  open_links: openLinksPreferenceValues,
  open_links_background: booleanStringPreferenceValues,
  sort_unread: sortOrderPreferenceValues,
  group_by: groupByPreferenceValues,
  cmd_click_browser: booleanStringPreferenceValues,
  ask_before_mark_all: booleanStringPreferenceValues,
  list_selection_style: listSelectionStylePreferenceValues,
  sidebar_density: sidebarDensityPreferenceValues,
  layout: layoutPreferenceValues,
  theme: themePreferenceValues,
  opaque_sidebars: booleanStringPreferenceValues,
  grayscale_favicons: booleanStringPreferenceValues,
  font_style: fontStylePreferenceValues,
  font_size: fontSizePreferenceValues,
  show_starred_count: booleanStringPreferenceValues,
  show_unread_count: booleanStringPreferenceValues,
  show_sidebar_unread: booleanStringPreferenceValues,
  show_sidebar_starred: booleanStringPreferenceValues,
  show_sidebar_recent_articles: booleanStringPreferenceValues,
  show_sidebar_tags: booleanStringPreferenceValues,
  startup_folder_expansion: startupFolderExpansionPreferenceValues,
  image_previews: imagePreviewsPreferenceValues,
  display_favicons: booleanStringPreferenceValues,
  text_preview: booleanStringPreferenceValues,
  dim_archived: booleanStringPreferenceValues,
  reader_mode_default: booleanStringPreferenceValues,
  web_preview_mode_default: booleanStringPreferenceValues,
  web_preview_keep_focus: booleanStringPreferenceValues,
  window_always_on_top: booleanStringPreferenceValues,
  reading_sort: sortOrderPreferenceValues,
  after_reading: afterReadingPreferenceValues,
  scroll_to_top_on_change: booleanStringPreferenceValues,
  open_first_article_on_feed_selection: booleanStringPreferenceValues,
  recent_articles_history_enabled: booleanStringPreferenceValues,
  sort_subscriptions: sortSubscriptionsPreferenceValues,
  sync_on_startup: booleanStringPreferenceValues,
  developer_mode: booleanStringPreferenceValues,
  action_copy_link: booleanStringPreferenceValues,
  action_open_browser: booleanStringPreferenceValues,
  debug_browser_hud: booleanStringPreferenceValues,
  mute_auto_mark_read: booleanStringPreferenceValues,
};

function pickAllowedValue(allowed: readonly string[], value: string): string | null {
  return allowed.includes(value) ? value : null;
}

function parseKnownPreferenceValue<K extends KnownPreferenceKey>(key: K, value: string): PreferenceValue<K> | null {
  if (key === "debug_web_preview_url") {
    return isUtf8ByteLimitedString(value, preferenceValueMaxUtf8Bytes) ? (value as PreferenceValue<K>) : null;
  }

  if (key === "debug_agentation_visibility") {
    if (value === "hide_in_settings") {
      return "always" as PreferenceValue<K>;
    }
    return debugAgentationVisibilityPreferenceValues.includes(value as DebugAgentationVisibilityPreference)
      ? (value as PreferenceValue<K>)
      : null;
  }

  return pickAllowedValue(picklistPreferenceValues[key as PicklistPreferenceKey], value) as PreferenceValue<K> | null;
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

  const resolvedValue = resolveLegacyPreferenceValue(key, value);

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

  const resolvedValue = key === "font_style" ? resolveLegacyPreferenceValue(key, value) : value;
  return parseKnownPreferenceValue(key, resolvedValue) !== null;
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
