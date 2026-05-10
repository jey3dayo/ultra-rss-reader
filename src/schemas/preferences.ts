import { z } from "zod";
import {
  isShortcutPreferenceKey,
  type KeyboardShortcutPrefs,
  type ShortcutPreferenceKey,
  shortcutDefaults,
} from "@/lib/keyboard/keyboard-shortcuts";

export const themeSchema = z.enum(["light", "dark", "system"]);
const languageSchema = z.enum(["system", "en", "ja"]);
const unreadBadgeSchema = z.enum(["dont_display", "all_unread", "only_inbox"]);
const openLinksSchema = z.enum(["in_app", "default_browser"]);
const booleanStringSchema = z.enum(["true", "false"]);
const sortOrderSchema = z.enum(["newest_first", "oldest_first"]);
const groupBySchema = z.enum(["date", "feed", "none"]);
const listSelectionStyleSchema = z.enum(["modern", "classic"]);
const sidebarDensitySchema = z.enum(["compact", "normal", "spacious"]);
const layoutSchema = z.enum(["automatic", "wide", "compact"]);
const fontStyleSchema = z.enum(["sans_serif", "serif", "monospace"]);
const fontSizeSchema = z.enum(["small", "medium", "large"]);
const imagePreviewsSchema = z.enum(["off", "small", "medium", "large"]);
const afterReadingSchema = z.enum(["never", "immediately", "after_0_3s", "after_0_5s", "after_1s"]);
const sortSubscriptionsSchema = z.enum(["folders_first", "alphabetical", "newest_first", "oldest_first"]);
const startupFolderExpansionSchema = z.enum(["all_collapsed", "unread_folders", "restore_previous"]);
const persistedBooleanPreferenceSchema = z.enum(["true", "false"]);
export const preferenceKeyMaxLength = 128;
export const preferenceValueMaxUtf8Bytes = 1024;
export const reservedUnknownPreferenceKeyPrefixes = ["shortcut_"] as const;
const hasControlCharacter = (value: string): boolean =>
  Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0);
    return codePoint !== undefined && ((codePoint >= 0 && codePoint <= 31) || (codePoint >= 127 && codePoint <= 159));
  });
const freeformPreferenceStringSchema = z.string().refine((value) => !hasControlCharacter(value));
const debugWebPreviewUrlSchema = freeformPreferenceStringSchema.max(preferenceValueMaxUtf8Bytes);
const selectedAccountIdSchema = freeformPreferenceStringSchema
  .transform((value) => value.trim())
  .pipe(z.string().min(1).max(256));
export const shortcutPreferenceValueSchema = z
  .string()
  .refine((value) => !hasControlCharacter(value))
  .transform((value) => value.trim())
  .pipe(z.string().min(1).max(128));

export type Theme = z.infer<typeof themeSchema>;
export type LanguagePreference = z.infer<typeof languageSchema>;
export type SortSubscriptions = z.infer<typeof sortSubscriptionsSchema>;
export type AfterReadingPreference = z.infer<typeof afterReadingSchema>;
export type UnreadBadgePreference = z.infer<typeof unreadBadgeSchema>;
export type SidebarDensityPreference = z.infer<typeof sidebarDensitySchema>;
export type StartupFolderExpansionPreference = z.infer<typeof startupFolderExpansionSchema>;
export type FontStylePreference = z.infer<typeof fontStyleSchema>;
export type FontSizePreference = z.infer<typeof fontSizeSchema>;

export const preferenceSchemas = {
  language: languageSchema,
  unread_badge: unreadBadgeSchema,
  open_links: openLinksSchema,
  open_links_background: booleanStringSchema,
  sort_unread: sortOrderSchema,
  group_by: groupBySchema,
  cmd_click_browser: booleanStringSchema,
  ask_before_mark_all: booleanStringSchema,
  list_selection_style: listSelectionStyleSchema,
  sidebar_density: sidebarDensitySchema,
  layout: layoutSchema,
  theme: themeSchema,
  opaque_sidebars: booleanStringSchema,
  grayscale_favicons: booleanStringSchema,
  font_style: fontStyleSchema,
  font_size: fontSizeSchema,
  show_starred_count: booleanStringSchema,
  show_unread_count: booleanStringSchema,
  show_sidebar_unread: booleanStringSchema,
  show_sidebar_starred: booleanStringSchema,
  show_sidebar_recent_articles: booleanStringSchema,
  show_sidebar_tags: booleanStringSchema,
  startup_folder_expansion: startupFolderExpansionSchema,
  image_previews: imagePreviewsSchema,
  display_favicons: booleanStringSchema,
  text_preview: booleanStringSchema,
  dim_archived: booleanStringSchema,
  reader_mode_default: persistedBooleanPreferenceSchema,
  web_preview_mode_default: persistedBooleanPreferenceSchema,
  web_preview_keep_focus: persistedBooleanPreferenceSchema,
  window_always_on_top: persistedBooleanPreferenceSchema,
  reading_sort: sortOrderSchema,
  after_reading: afterReadingSchema,
  scroll_to_top_on_change: booleanStringSchema,
  open_first_article_on_feed_selection: booleanStringSchema,
  recent_articles_history_enabled: booleanStringSchema,
  sort_subscriptions: sortSubscriptionsSchema,
  sync_on_startup: persistedBooleanPreferenceSchema,
  action_copy_link: booleanStringSchema,
  action_open_browser: booleanStringSchema,
  debug_browser_hud: booleanStringSchema,
  debug_web_preview_url: debugWebPreviewUrlSchema,
  mute_auto_mark_read: booleanStringSchema,
};

export type KnownPreferenceKey = keyof typeof preferenceSchemas;
export type PreferenceWritableKey = KnownPreferenceKey | ShortcutPreferenceKey | "selected_account_id";
type KnownPreferenceRecord = Partial<{
  [K in KnownPreferenceKey]: string;
}>;
type ShortcutPreferenceRecord = KeyboardShortcutPrefs;
type BackendPassthroughPreferenceRecord = {
  [K in string]: string;
};
export type PreferenceRecord = KnownPreferenceRecord & ShortcutPreferenceRecord & BackendPassthroughPreferenceRecord;
type PreferenceValue<K extends KnownPreferenceKey> = z.output<(typeof preferenceSchemas)[K]>;

const objectHasOwnProperty = Object.prototype.hasOwnProperty;
const backendOwnedPreferenceKeys = ["selected_account_id"] as const;
const retiredBackendPassthroughPreferenceKeys = [] as const;
const retiredBackendPassthroughPreferenceKeySet: ReadonlySet<string> = new Set(retiredBackendPassthroughPreferenceKeys);
const preferenceTypoDetectionDistance = 2;
const typoDetectionCandidateKeys = [
  ...Object.keys(preferenceSchemas),
  ...Object.keys(shortcutDefaults),
  ...backendOwnedPreferenceKeys,
] as const;

const hiddenPreferenceDefaultKeys = [
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

const corePreferenceDefaults = {
  // General
  language: "system",
  unread_badge: "dont_display",
  open_links: "in_app",
  open_links_background: "false",
  sort_unread: "newest_first",
  group_by: "date",
  cmd_click_browser: "false",
  ask_before_mark_all: "true",
  // Appearance
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
  // Reading
  reader_mode_default: "true",
  web_preview_mode_default: "false",
  web_preview_keep_focus: "false",
  window_always_on_top: "false",
  reading_sort: "newest_first",
  after_reading: "after_0_3s",
  scroll_to_top_on_change: "true",
  open_first_article_on_feed_selection: "false",
  recent_articles_history_enabled: "true",
  // Account-level reading preferences
  sort_subscriptions: "folders_first",
  sync_on_startup: "true",
  // Actions
  action_copy_link: "true",
  action_open_browser: "true",
  // Debug
  debug_browser_hud: "false",
  debug_web_preview_url: "",
  mute_auto_mark_read: "false",
} satisfies {
  [K in KnownPreferenceKey]: z.input<(typeof preferenceSchemas)[K]>;
};

const hiddenPreferenceDefaults: Record<HiddenPreferenceKey, string> = {
  action_open_browser: corePreferenceDefaults.action_open_browser,
  sort_subscriptions: corePreferenceDefaults.sort_subscriptions,
};

function isKnownPreferenceKey(key: string): key is KnownPreferenceKey {
  return objectHasOwnProperty.call(preferenceSchemas, key);
}

function isBackendOwnedPreferenceKey(key: string): key is (typeof backendOwnedPreferenceKeys)[number] {
  return backendOwnedPreferenceKeys.some((backendOwnedKey) => backendOwnedKey === key);
}

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
  if (isKnownPreferenceKey(key) || isShortcutPreferenceKey(key) || key === "selected_account_id") {
    return null;
  }

  let likelyCandidate: string | null = null;
  let likelyCandidateDistance = preferenceTypoDetectionDistance + 1;
  for (const candidate of typoDetectionCandidateKeys) {
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

export function getPreferenceValueSchema(key: string): z.ZodType | undefined {
  if (isKnownPreferenceKey(key)) {
    return preferenceSchemas[key];
  }

  if (isShortcutPreferenceKey(key)) {
    return shortcutPreferenceValueSchema;
  }

  if (isBackendOwnedPreferenceKey(key)) {
    return selectedAccountIdSchema;
  }

  return undefined;
}

function parsePreferenceValue(key: KnownPreferenceKey, value: string): string | null {
  const schema = preferenceSchemas[key];
  const result = schema.safeParse(value);
  return result.success ? result.data : null;
}

export function normalizePreferenceValue<K extends KnownPreferenceKey>(key: K, value: string): PreferenceValue<K>;
export function normalizePreferenceValue(key: string, value: string): string;
export function normalizePreferenceValue(key: string, value: string): string {
  if (isShortcutPreferenceKey(key)) {
    const result = shortcutPreferenceValueSchema.safeParse(value);
    return result.success ? result.data : (preferenceDefaults[key] ?? "");
  }

  if (isBackendOwnedPreferenceKey(key)) {
    const result = selectedAccountIdSchema.safeParse(value);
    return result.success ? result.data : "";
  }

  if (!isKnownPreferenceKey(key)) {
    return value;
  }

  const resolvedValue =
    key === "after_reading" && objectHasOwnProperty.call(legacyAfterReadingValueMap, value)
      ? legacyAfterReadingValueMap[value]
      : value;

  const parsedValue = parsePreferenceValue(key, resolvedValue);
  if (parsedValue !== null) {
    return parsedValue;
  }

  const parsedDefault = parsePreferenceValue(key, corePreferenceDefaults[key]);
  return parsedDefault ?? "";
}

export function normalizePreferenceRecord(prefs: PreferenceRecord): PreferenceRecord {
  return Object.fromEntries(Object.entries(prefs).map(([key, value]) => [key, normalizePreferenceValue(key, value)]));
}

export function parseThemePreference(value: string): Theme | null {
  const result = themeSchema.safeParse(value);
  return result.success ? result.data : null;
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
  return normalizePreferenceValue(key, prefs[key] ?? fallbackValue ?? "");
}
