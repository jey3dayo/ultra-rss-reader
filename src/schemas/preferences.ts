import * as v from "valibot";
import { isShortcutPreferenceKey } from "@/lib/keyboard/keyboard-shortcuts";
import {
  afterReadingPreferenceValues,
  booleanStringPreferenceValues,
  debugAgentationVisibilityPreferenceValues,
  developerModePreferenceValues,
  fontSizePreferenceValues,
  fontStylePreferenceValues,
  groupByPreferenceValues,
  imagePreviewsPreferenceValues,
  isBackendOwnedPreferenceKey,
  isKnownPreferenceKey,
  type KnownPreferenceKey,
  languagePreferenceValues,
  layoutPreferenceValues,
  listSelectionStylePreferenceValues,
  openLinksPreferenceValues,
  preferenceValueMaxUtf8Bytes,
  sidebarDensityPreferenceValues,
  sortOrderPreferenceValues,
  sortSubscriptionsPreferenceValues,
  startupFolderExpansionPreferenceValues,
  themePreferenceValues,
  unreadBadgePreferenceValues,
} from "@/schemas/preference-values";

export {
  type AfterReadingPreference,
  backendOwnedPreferenceKeys,
  type DebugAgentationVisibilityPreference,
  type FontSizePreference,
  type FontStylePreference,
  getLikelyPreferenceKeyTypo,
  type HiddenPreferenceKey,
  isRetiredBackendPassthroughPreferenceKey,
  type KnownPreferenceKey,
  type LanguagePreference,
  normalizePreferenceRecord,
  normalizePreferenceValue,
  type PreferenceDefaultsRecord,
  type PreferenceRecord,
  type PreferenceWritableKey,
  parseLanguagePreference,
  parseThemePreference,
  preferenceDefaults,
  preferenceKeyMaxLength,
  preferenceValueMaxUtf8Bytes,
  reservedUnknownPreferenceKeyPrefixes,
  resolvePreferenceValue,
  type SidebarDensityPreference,
  type SortSubscriptions,
  type StartupFolderExpansionPreference,
  type Theme,
  type UnreadBadgePreference,
  type VisiblePreferenceDefaultKey,
} from "@/schemas/preference-values";

export { languagePreferenceValues };

export const themeSchema = v.picklist(themePreferenceValues);
const languageSchema = v.picklist(languagePreferenceValues);
const unreadBadgeSchema = v.picklist(unreadBadgePreferenceValues);
const openLinksSchema = v.picklist(openLinksPreferenceValues);
const booleanStringSchema = v.picklist(booleanStringPreferenceValues);
const sortOrderSchema = v.picklist(sortOrderPreferenceValues);
const groupBySchema = v.picklist(groupByPreferenceValues);
const listSelectionStyleSchema = v.picklist(listSelectionStylePreferenceValues);
const sidebarDensitySchema = v.picklist(sidebarDensityPreferenceValues);
const layoutSchema = v.picklist(layoutPreferenceValues);
const fontStyleSchema = v.picklist(fontStylePreferenceValues);
const fontSizeSchema = v.picklist(fontSizePreferenceValues);
const imagePreviewsSchema = v.picklist(imagePreviewsPreferenceValues);
const afterReadingSchema = v.picklist(afterReadingPreferenceValues);
const sortSubscriptionsSchema = v.picklist(sortSubscriptionsPreferenceValues);
const startupFolderExpansionSchema = v.picklist(startupFolderExpansionPreferenceValues);
const developerModeSchema = v.picklist(developerModePreferenceValues);
const debugAgentationVisibilitySchema = v.pipe(
  v.picklist(debugAgentationVisibilityPreferenceValues),
  v.transform((value) => (value === "hide_in_settings" ? "always" : value)),
);
const persistedBooleanPreferenceSchema = v.picklist(booleanStringPreferenceValues);
const textEncoder = new TextEncoder();
const hasControlCharacter = (value: string): boolean =>
  Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0);
    return codePoint !== undefined && ((codePoint >= 0 && codePoint <= 31) || (codePoint >= 127 && codePoint <= 159));
  });
const freeformPreferenceStringSchema = v.pipe(
  v.string(),
  v.check((value) => !hasControlCharacter(value)),
);
const utf8ByteLimitedStringSchema = (maxBytes: number) =>
  v.pipe(
    freeformPreferenceStringSchema,
    v.check((value) => textEncoder.encode(value).length <= maxBytes),
  );
const debugWebPreviewUrlSchema = utf8ByteLimitedStringSchema(preferenceValueMaxUtf8Bytes);
const selectedAccountIdSchema = v.pipe(
  freeformPreferenceStringSchema,
  v.transform((value) => value.trim()),
  v.minLength(1),
  v.maxLength(256),
);
export const shortcutPreferenceValueSchema = v.pipe(
  v.string(),
  v.check((value) => !hasControlCharacter(value)),
  v.transform((value) => value.trim()),
  v.minLength(1),
  v.check((value) => textEncoder.encode(value).length <= 128),
);

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
  developer_mode: developerModeSchema,
  action_copy_link: booleanStringSchema,
  action_open_browser: booleanStringSchema,
  debug_browser_hud: booleanStringSchema,
  debug_web_preview_url: debugWebPreviewUrlSchema,
  debug_agentation_visibility: debugAgentationVisibilitySchema,
  mute_auto_mark_read: booleanStringSchema,
};

export function getPreferenceValueSchema(
  key: string,
): v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>> | undefined {
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

export function isReservedUnknownPreferenceKey(key: string): boolean {
  if (getPreferenceValueSchema(key)) {
    return false;
  }

  return key.startsWith("shortcut_");
}

export function parsePreferenceValue(key: KnownPreferenceKey, value: string): string | null {
  const schema = preferenceSchemas[key];
  const result = v.safeParse(schema, value);
  return result.success ? result.output : null;
}
