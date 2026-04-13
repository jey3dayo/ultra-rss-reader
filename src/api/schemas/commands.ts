import { z } from "zod";

// --- listFolders / listFeeds ---
export const listFoldersArgs = z.object({ accountId: z.string() });
export const listFeedsArgs = z.object({ accountId: z.string() });

// --- listArticles ---
export const listArticlesArgs = z.object({
  feedId: z.string(),
  offset: z.number().optional(),
  limit: z.number().optional(),
});

// --- listAccountArticles ---
export const listAccountArticlesArgs = z.object({
  accountId: z.string(),
  offset: z.number().optional(),
  limit: z.number().optional(),
});

// --- countAccountUnreadArticles ---
export const countAccountUnreadArticlesArgs = z.object({ accountId: z.string() });

// --- searchArticles ---
export const searchArticlesArgs = z.object({
  accountId: z.string(),
  query: z.string(),
  offset: z.number().optional(),
  limit: z.number().optional(),
});

// --- markArticleRead ---
export const markArticleReadArgs = z.object({
  articleId: z.string(),
  read: z.boolean().optional(),
});

// --- markArticlesRead ---
export const markArticlesReadArgs = z.object({ articleIds: z.array(z.string()) });

// --- toggleArticleStar ---
export const toggleArticleStarArgs = z.object({
  articleId: z.string(),
  starred: z.boolean(),
});

// --- markFeedRead ---
export const markFeedReadArgs = z.object({ feedId: z.string() });

// --- markFolderRead ---
export const markFolderReadArgs = z.object({ folderId: z.string() });

// --- addAccount ---
export const addAccountArgs = z.object({
  kind: z.string(),
  name: z.string(),
  serverUrl: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
});

// --- updateAccountSync ---
export const updateAccountSyncArgs = z.object({
  accountId: z.string(),
  syncIntervalSecs: z.number(),
  syncOnWake: z.boolean(),
  keepReadItemsDays: z.number(),
});

// --- updateAccountCredentials ---
export const updateAccountCredentialsArgs = z.object({
  accountId: z.string(),
  serverUrl: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
});

// --- renameAccount ---
export const renameAccountArgs = z.object({
  accountId: z.string(),
  name: z.string(),
});

// --- syncAccount ---
export const syncAccountArgs = z.object({ accountId: z.string() });
export const getAccountSyncStatusArgs = z.object({ accountId: z.string() });

// --- syncFeed ---
export const syncFeedArgs = z.object({ feedId: z.string() });

// --- testAccountConnection ---
export const testAccountConnectionArgs = z.object({ accountId: z.string() });

// --- deleteAccount ---
export const deleteAccountArgs = z.object({ accountId: z.string() });

// --- discoverFeeds ---
export const discoverFeedsArgs = z.object({ url: z.string() });

// --- addLocalFeed ---
export const addLocalFeedArgs = z.object({
  accountId: z.string(),
  url: z.string(),
});

// --- createFolder ---
export const createFolderArgs = z.object({
  accountId: z.string(),
  name: z.string(),
});

// --- deleteFeed ---
export const deleteFeedArgs = z.object({ feedId: z.string() });

// --- renameFeed ---
export const renameFeedArgs = z.object({
  feedId: z.string(),
  title: z.string(),
});

// --- updateFeedFolder ---
export const updateFeedFolderArgs = z.object({
  feedId: z.string(),
  folderId: z.string().nullable(),
});

const feedDisplayModeValue = z.enum(["inherit", "on", "off"]);

// --- updateFeedDisplaySettings ---
export const updateFeedDisplaySettingsArgs = z.object({
  feedId: z.string(),
  readerMode: feedDisplayModeValue,
  webPreviewMode: feedDisplayModeValue,
});

// --- openInBrowser ---
export const openInBrowserArgs = z.object({
  url: z.string(),
  background: z.boolean().optional(),
});

// --- checkBrowserEmbedSupport ---
export const checkBrowserEmbedSupportArgs = z.object({ url: z.string() });

// --- browser webview ---
export const browserWebviewBoundsArgs = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  unit: z.enum(["logical", "physical"]).optional(),
});
export const createOrUpdateBrowserWebviewArgs = z.object({
  url: z.string(),
  bounds: browserWebviewBoundsArgs,
});
export const setBrowserWebviewBoundsArgs = z.object({ bounds: browserWebviewBoundsArgs });

// --- exportOpml ---
export const exportOpmlArgs = z.object({ accountId: z.string() });

// --- setPreference ---
export const setPreferenceArgs = z.object({
  key: z.string(),
  value: z.string(),
});

// --- copyToClipboard ---
export const copyToClipboardArgs = z.object({ text: z.string() });

// --- addToReadingList ---
export const addToReadingListArgs = z.object({ url: z.string() });

// --- createTag ---
export const createTagArgs = z.object({
  name: z.string(),
  color: z.string().optional(),
});

// --- renameTag ---
export const renameTagArgs = z.object({
  tagId: z.string(),
  name: z.string(),
  color: z.string().nullish(),
});

// --- deleteTag ---
export const deleteTagArgs = z.object({ tagId: z.string() });

// --- tagArticle ---
export const tagArticleArgs = z.object({
  articleId: z.string(),
  tagId: z.string(),
});

// --- untagArticle ---
export const untagArticleArgs = z.object({
  articleId: z.string(),
  tagId: z.string(),
});

// --- getArticleTags ---
export const getArticleTagsArgs = z.object({ articleId: z.string() });

// --- listArticlesByTag ---
export const listArticlesByTagArgs = z.object({
  tagId: z.string(),
  offset: z.number().optional(),
  limit: z.number().optional(),
  accountId: z.string().optional(),
});

// --- getTagArticleCounts ---
export const getTagArticleCountsArgs = z.object({
  accountId: z.string().optional(),
});

// Registry: command names (snake_case) -> schema (only commands with args)
export const commandArgsSchemas: Record<string, z.ZodType> = {
  list_folders: listFoldersArgs,
  list_feeds: listFeedsArgs,
  list_articles: listArticlesArgs,
  list_account_articles: listAccountArticlesArgs,
  count_account_unread_articles: countAccountUnreadArticlesArgs,
  search_articles: searchArticlesArgs,
  mark_article_read: markArticleReadArgs,
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
  check_browser_embed_support: checkBrowserEmbedSupportArgs,
  create_or_update_browser_webview: createOrUpdateBrowserWebviewArgs,
  set_browser_webview_bounds: setBrowserWebviewBoundsArgs,
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
};
