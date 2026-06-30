import { z } from "zod";
import { isShortcutPreferenceKey } from "@/lib/keyboard/keyboard-shortcuts";
import {
  afterReadingPreferenceValues,
  booleanStringPreferenceValues,
  debugAgentationVisibilityPreferenceValues,
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

export const themeSchema = z.enum(themePreferenceValues);
const languageSchema = z.enum(languagePreferenceValues);
const unreadBadgeSchema = z.enum(unreadBadgePreferenceValues);
const openLinksSchema = z.enum(openLinksPreferenceValues);
const booleanStringSchema = z.enum(booleanStringPreferenceValues);
const sortOrderSchema = z.enum(sortOrderPreferenceValues);
const groupBySchema = z.enum(groupByPreferenceValues);
const listSelectionStyleSchema = z.enum(listSelectionStylePreferenceValues);
const sidebarDensitySchema = z.enum(sidebarDensityPreferenceValues);
const layoutSchema = z.enum(layoutPreferenceValues);
const fontStyleSchema = z.enum(fontStylePreferenceValues);
const fontSizeSchema = z.enum(fontSizePreferenceValues);
const imagePreviewsSchema = z.enum(imagePreviewsPreferenceValues);
const afterReadingSchema = z.enum(afterReadingPreferenceValues);
const sortSubscriptionsSchema = z.enum(sortSubscriptionsPreferenceValues);
const startupFolderExpansionSchema = z.enum(startupFolderExpansionPreferenceValues);
const debugAgentationVisibilitySchema = z.enum(debugAgentationVisibilityPreferenceValues);
const persistedBooleanPreferenceSchema = z.enum(booleanStringPreferenceValues);
const textEncoder = new TextEncoder();
const hasControlCharacter = (value: string): boolean =>
  Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0);
    return codePoint !== undefined && ((codePoint >= 0 && codePoint <= 31) || (codePoint >= 127 && codePoint <= 159));
  });
const freeformPreferenceStringSchema = z.string().refine((value) => !hasControlCharacter(value));
const utf8ByteLimitedStringSchema = (maxBytes: number) =>
  freeformPreferenceStringSchema.refine((value) => textEncoder.encode(value).length <= maxBytes);
const debugWebPreviewUrlSchema = utf8ByteLimitedStringSchema(preferenceValueMaxUtf8Bytes);
const selectedAccountIdSchema = freeformPreferenceStringSchema
  .transform((value) => value.trim())
  .pipe(z.string().min(1).max(256));
export const shortcutPreferenceValueSchema = z
  .string()
  .refine((value) => !hasControlCharacter(value))
  .transform((value) => value.trim())
  .pipe(
    z
      .string()
      .min(1)
      .refine((value) => textEncoder.encode(value).length <= 128),
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
  action_copy_link: booleanStringSchema,
  action_open_browser: booleanStringSchema,
  debug_browser_hud: booleanStringSchema,
  debug_web_preview_url: debugWebPreviewUrlSchema,
  debug_agentation_visibility: debugAgentationVisibilitySchema,
  mute_auto_mark_read: booleanStringSchema,
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

export function isReservedUnknownPreferenceKey(key: string): boolean {
  if (getPreferenceValueSchema(key)) {
    return false;
  }

  return key.startsWith("shortcut_");
}

export function parsePreferenceValue(key: KnownPreferenceKey, value: string): string | null {
  const schema = preferenceSchemas[key];
  const result = schema.safeParse(value);
  return result.success ? result.data : null;
}
