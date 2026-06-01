import type { z } from "zod";
import {
  addAccountArgs,
  deleteAccountArgs,
  getAccountSyncStatusArgs,
  renameAccountArgs,
  startupSyncArgs,
  syncAccountArgs,
  testAccountConnectionArgs,
  updateAccountCredentialsArgs,
  updateAccountSyncArgs,
} from "./account";
import {
  cleanupFeedIntegrityOrphansArgs,
  clearArticleViewHistoryArgs,
  countAccountStarredArticlesArgs,
  countAccountUnreadArticlesArgs,
  getArticleArgs,
  listAccountArticlesArgs,
  listArticlesArgs,
  listFeedArticleSummariesArgs,
  listFolderArticlesArgs,
  listRecentArticlesArgs,
  listStarredArticlesArgs,
  markAccountReadArgs,
  markArticleReadArgs,
  markArticlesReadArgs,
  markFeedReadArgs,
  markFolderReadArgs,
  oldUnreadArticlesArgs,
  recordArticleViewArgs,
  searchArticlesArgs,
  toggleArticleStarArgs,
  unstarAccountArticlesArgs,
} from "./article";
import {
  checkBrowserEmbedSupportArgs,
  createOrUpdateBrowserWebviewArgs,
  setBrowserWebviewBoundsArgs,
} from "./browser-webview";
import {
  addLocalFeedArgs,
  createFolderArgs,
  deleteFeedArgs,
  discoverFeedsArgs,
  listFeedsArgs,
  listFoldersArgs,
  renameFeedArgs,
  syncFeedArgs,
  updateFeedDisplaySettingsArgs,
  updateFeedFolderArgs,
} from "./feed-folder";
import {
  addToReadingListArgs,
  copyToClipboardArgs,
  exportOpmlArgs,
  importOpmlArgs,
  openExternalUrlArgs,
  openInBrowserArgs,
  setPreferenceArgs,
} from "./integration";
import {
  createMuteKeywordArgs,
  deleteMuteKeywordArgs,
  setMuteAutoMarkReadArgs,
  updateMuteKeywordArgs,
} from "./mute-keyword";
import {
  createTagArgs,
  deleteTagArgs,
  getArticleTagsArgs,
  getTagArticleCountsArgs,
  listArticlesByTagArgs,
  renameTagArgs,
  tagArticleArgs,
  untagArticleArgs,
} from "./tag";

type CommandArgsSchema = z.ZodType<Record<string, unknown>>;

// Registry: command names (snake_case) -> schema (only commands with args)
export const commandArgsSchemas = {
  list_folders: listFoldersArgs,
  list_feeds: listFeedsArgs,
  get_article: getArticleArgs,
  list_articles: listArticlesArgs,
  list_account_articles: listAccountArticlesArgs,
  list_feed_article_summaries: listFeedArticleSummariesArgs,
  list_folder_articles: listFolderArticlesArgs,
  list_starred_articles: listStarredArticlesArgs,
  list_recent_articles: listRecentArticlesArgs,
  count_account_unread_articles: countAccountUnreadArticlesArgs,
  count_account_starred_articles: countAccountStarredArticlesArgs,
  mark_account_read: markAccountReadArgs,
  mark_account_starred_read: markAccountReadArgs,
  count_old_unread_articles: oldUnreadArticlesArgs,
  mark_old_unread_read: oldUnreadArticlesArgs,
  unstar_account_articles: unstarAccountArticlesArgs,
  cleanup_feed_integrity_orphans: cleanupFeedIntegrityOrphansArgs,
  search_articles: searchArticlesArgs,
  mark_article_read: markArticleReadArgs,
  record_article_view: recordArticleViewArgs,
  clear_article_view_history: clearArticleViewHistoryArgs,
  mark_articles_read: markArticlesReadArgs,
  toggle_article_star: toggleArticleStarArgs,
  mark_feed_read: markFeedReadArgs,
  mark_folder_read: markFolderReadArgs,
  add_account: addAccountArgs,
  update_account_sync: updateAccountSyncArgs,
  update_account_credentials: updateAccountCredentialsArgs,
  rename_account: renameAccountArgs,
  test_account_connection: testAccountConnectionArgs,
  delete_account: deleteAccountArgs,
  get_account_sync_status: getAccountSyncStatusArgs,
  trigger_startup_sync: startupSyncArgs,
  trigger_sync_account: syncAccountArgs,
  trigger_sync_feed: syncFeedArgs,
  discover_feeds: discoverFeedsArgs,
  add_local_feed: addLocalFeedArgs,
  create_folder: createFolderArgs,
  delete_feed: deleteFeedArgs,
  rename_feed: renameFeedArgs,
  update_feed_folder: updateFeedFolderArgs,
  update_feed_display_settings: updateFeedDisplaySettingsArgs,
  open_in_browser: openInBrowserArgs,
  "plugin:opener|open_url": openExternalUrlArgs,
  check_browser_embed_support: checkBrowserEmbedSupportArgs,
  create_or_update_browser_webview: createOrUpdateBrowserWebviewArgs,
  set_browser_webview_bounds: setBrowserWebviewBoundsArgs,
  import_opml: importOpmlArgs,
  export_opml: exportOpmlArgs,
  set_preference: setPreferenceArgs,
  copy_to_clipboard: copyToClipboardArgs,
  add_to_reading_list: addToReadingListArgs,
  create_tag: createTagArgs,
  rename_tag: renameTagArgs,
  delete_tag: deleteTagArgs,
  tag_article: tagArticleArgs,
  untag_article: untagArticleArgs,
  get_article_tags: getArticleTagsArgs,
  list_articles_by_tag: listArticlesByTagArgs,
  get_tag_article_counts: getTagArticleCountsArgs,
  create_mute_keyword: createMuteKeywordArgs,
  update_mute_keyword: updateMuteKeywordArgs,
  delete_mute_keyword: deleteMuteKeywordArgs,
  set_mute_auto_mark_read: setMuteAutoMarkReadArgs,
} as const satisfies Record<string, CommandArgsSchema>;

export type CommandArgsSchemaRegistry = typeof commandArgsSchemas;
export type CommandWithArgs = keyof CommandArgsSchemaRegistry;

export function isCommandWithArgs(commandName: string): commandName is CommandWithArgs {
  // biome-ignore lint: Object.hasOwn is outside the current TypeScript lib target.
  return Object.prototype.hasOwnProperty.call(commandArgsSchemas, commandName);
}

export function getCommandArgsSchema<TCommand extends CommandWithArgs>(
  commandName: TCommand,
): CommandArgsSchemaRegistry[TCommand];
export function getCommandArgsSchema(commandName: string): CommandArgsSchema | undefined;
export function getCommandArgsSchema(commandName: string): CommandArgsSchema | undefined {
  if (isCommandWithArgs(commandName)) {
    return commandArgsSchemas[commandName];
  }

  return undefined;
}
