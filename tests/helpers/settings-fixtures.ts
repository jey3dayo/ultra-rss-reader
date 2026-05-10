import type { listAccounts, listMuteKeywords, listTags } from "@/api/tauri-commands";
import type { VisiblePreferenceDefaultKey } from "@/schemas/preferences";
import {
  type CommandListItem,
  cloneFixtureSeed,
  type MutableTestFixture,
  type ReadonlyFixtureSeed,
} from "./fixture-types";

type AccountFixture = CommandListItem<typeof listAccounts>;
type MuteKeywordFixture = CommandListItem<typeof listMuteKeywords>;
type TagFixture = CommandListItem<typeof listTags>;

export const settingsPreferenceLabelKeys = {
  language: "general.language",
  unread_badge: "general.unread_count_badge",
  open_links: "reading.open_links",
  open_links_background: "reading.open_links_in_background",
  sort_unread: "reading.sort",
  group_by: "reading.group_by",
  cmd_click_browser: "reading.cmd_click_browser",
  ask_before_mark_all: "reading.ask_before_mark_all",
  list_selection_style: "appearance.list_selection_style",
  sidebar_density: "appearance.sidebar_density",
  layout: "appearance.layout",
  theme: "appearance.theme",
  opaque_sidebars: "appearance.opaque_sidebars",
  grayscale_favicons: "appearance.grayscale_favicons",
  font_style: "appearance.app_font_style",
  font_size: "appearance.font_size",
  show_starred_count: "appearance.starred_list",
  show_unread_count: "appearance.unread_list",
  show_sidebar_unread: "general.show_unread",
  show_sidebar_starred: "general.show_starred",
  show_sidebar_recent_articles: "general.show_recent_articles",
  show_sidebar_tags: "general.show_tags",
  startup_folder_expansion: "general.startup_folder_expansion",
  image_previews: "appearance.image_previews",
  display_favicons: "appearance.display_favicons",
  text_preview: "appearance.text_preview",
  dim_archived: "appearance.dim_archived_articles",
  reader_mode_default: "reading.default_display_mode",
  web_preview_mode_default: "reading.default_display_mode",
  web_preview_keep_focus: "reading.web_preview_keep_focus",
  window_always_on_top: "reading.window_always_on_top",
  reading_sort: "reading.sort",
  after_reading: "reading.after_reading",
  scroll_to_top_on_change: "reading.scroll_to_top_on_feed_change",
  open_first_article_on_feed_selection: "reading.open_first_article_on_feed_selection",
  sync_on_startup: "general.sync_on_startup",
  action_copy_link: "actions.copy_link",
  debug_browser_hud: "debug.web_preview_hud",
  debug_web_preview_url: "debug.web_preview_url",
  mute_auto_mark_read: "mute.auto_mark_read",
  recent_articles_history_enabled: "reading.recent_articles_history_enabled",
} as const satisfies Record<Exclude<VisiblePreferenceDefaultKey, `shortcut_${string}`>, string>;

export const sampleAccountSeeds: ReadonlyFixtureSeed<AccountFixture> = [
  {
    id: "acc-1",
    kind: "local",
    name: "Local",
    display_name: "Local",
    icon_url: null,
    capabilities: {
      supports_folders: false,
      supports_starring: false,
      supports_search: false,
      supports_delta_sync: false,
      supports_remote_state: false,
    },
    username: null,
    server_url: null,
    sync_interval_secs: 3600,
    sync_on_startup: true,
    sync_on_wake: false,
    keep_read_items_days: 30,
  },
  {
    id: "acc-2",
    kind: "freshrss",
    name: "FreshRSS",
    display_name: "FreshRSS",
    icon_url: null,
    capabilities: {
      supports_folders: true,
      supports_starring: true,
      supports_search: true,
      supports_delta_sync: true,
      supports_remote_state: true,
    },
    username: "user",
    server_url: "https://freshrss.example.com",
    sync_interval_secs: 3600,
    sync_on_startup: true,
    sync_on_wake: false,
    keep_read_items_days: 30,
  },
];

export const sampleMuteKeywordSeeds: ReadonlyFixtureSeed<MuteKeywordFixture> = [
  {
    id: "mute-1",
    keyword: "Kindle Unlimited",
    scope: "title_and_body",
    created_at: "2026-04-15T01:00:00Z",
    updated_at: "2026-04-15T01:00:00Z",
  },
];

export const sampleTagSeeds: ReadonlyFixtureSeed<TagFixture> = [
  {
    id: "tag-1",
    name: "Tech",
    color: "#6f8eb8",
  },
  {
    id: "tag-2",
    name: "Later",
    color: null,
  },
];

export const sampleAccounts: MutableTestFixture<AccountFixture> = cloneFixtureSeed(sampleAccountSeeds);
export const sampleMuteKeywords: MutableTestFixture<MuteKeywordFixture> = cloneFixtureSeed(sampleMuteKeywordSeeds);
export const sampleTags: MutableTestFixture<TagFixture> = cloneFixtureSeed(sampleTagSeeds);

export function createSampleAccounts(): MutableTestFixture<AccountFixture> {
  return cloneFixtureSeed(sampleAccountSeeds);
}

export function createSampleMuteKeywords(): MutableTestFixture<MuteKeywordFixture> {
  return cloneFixtureSeed(sampleMuteKeywordSeeds);
}

export function createSampleTags(): MutableTestFixture<TagFixture> {
  return cloneFixtureSeed(sampleTagSeeds);
}
