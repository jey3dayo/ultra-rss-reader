import { i18nResourceLocales } from "@/lib/i18n-resources";

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
export const debugAgentationVisibilityPreferenceValues = ["always", "hide_in_settings", "off"] as const;
export type DebugAgentationVisibilityPreference = Exclude<
  (typeof debugAgentationVisibilityPreferenceValues)[number],
  "hide_in_settings"
>;
