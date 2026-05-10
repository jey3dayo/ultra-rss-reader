import { z } from "zod";
import { getPreferenceValueSchema } from "@/schemas/preferences";
import { FeedDisplayModeSchema } from "./feed";
import { MuteKeywordScopeSchema } from "./mute-keyword";

const articleListModeSchema = z.enum(["all", "unread", "starred"]);
export type ArticleListMode = z.output<typeof articleListModeSchema>;
export const MAX_IPC_PAGINATION_LIMIT = 200;
export const MAX_IPC_PAGINATION_OFFSET = 10_000;
export const ACCOUNT_NAME_MAX_CHARS = 100;
export const FEED_TITLE_MAX_CHARS = 200;
export const FOLDER_NAME_MAX_CHARS = 100;
export const TAG_NAME_MAX_CHARS = 50;
export const SHARE_COMMAND_TEXT_MAX_CHARS = 2048;
export const SHARE_COMMAND_TEXT_MAX_BYTES = SHARE_COMMAND_TEXT_MAX_CHARS * 4;
export const READING_LIST_URL_MAX_BYTES = 16 * 1024;
export const TAG_COLOR_VALIDATION_MESSAGE = "Color must be a valid hex color (e.g. #ff0000)";
const paginationOffsetSchema = z.number().int().nonnegative().max(MAX_IPC_PAGINATION_OFFSET);
const paginationLimitSchema = z.number().int().positive().max(MAX_IPC_PAGINATION_LIMIT);
const preferenceValueMaxBytes = 1024;
const textEncoder = new TextEncoder();
const nonBlankTrimmedStringSchema = z.string().trim().min(1);
const nonBlankTrimmedIdSchema = z.string().trim().min(1, { message: "Command id must not be blank" });
const accountNameSchema = nonBlankTrimmedStringSchema.max(ACCOUNT_NAME_MAX_CHARS, {
  message: `Account name must be ${ACCOUNT_NAME_MAX_CHARS} characters or less`,
});
const feedTitleSchema = nonBlankTrimmedStringSchema.max(FEED_TITLE_MAX_CHARS, {
  message: `Feed title must be ${FEED_TITLE_MAX_CHARS} characters or less`,
});
const folderNameSchema = nonBlankTrimmedStringSchema.max(FOLDER_NAME_MAX_CHARS, {
  message: `Folder name must be ${FOLDER_NAME_MAX_CHARS} characters or less`,
});
const tagNameSchema = nonBlankTrimmedStringSchema.max(TAG_NAME_MAX_CHARS, {
  message: `Tag name must be ${TAG_NAME_MAX_CHARS} characters or less`,
});
const tagColorSchema = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, TAG_COLOR_VALIDATION_MESSAGE)
  .transform((value) => value.toLowerCase());
const optionalTagColorSchema = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}, tagColorSchema.optional());
const nullableTagColorSchema = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}, tagColorSchema.nullish());
const optionalNonBlankTrimmedStringSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.trim() : value),
  z.string().min(1).optional(),
);
const optionalBlankStringToUndefinedSchema = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}, z.string().optional());
const nullableBlankStringToNullSchema = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}, z.string().nullable());
// biome-ignore lint/suspicious/noControlCharactersInRegex: IPC text fields must reject ASCII control characters.
const controlCharPattern = /[\u0000-\u001f\u007f]/u;
const whitespacePattern = /\s/u;
const graphemeSegmenter = new Intl.Segmenter(undefined, {
  granularity: "grapheme",
});

function countGraphemes(value: string): number {
  return Array.from(graphemeSegmenter.segment(value)).length;
}

function hasHttpUrlCredentials(value: string): boolean {
  try {
    const url = new URL(value);
    return url.username.length > 0 || url.password.length > 0;
  } catch {
    return false;
  }
}

export const httpCommandUrlSchema = z
  .string()
  .trim()
  .refine((url) => url.toLowerCase().startsWith("http://") || url.toLowerCase().startsWith("https://"), {
    message: "Only http:// and https:// URLs are supported",
  })
  .refine((url) => !url.includes("\n") && !url.includes("\r"), {
    message: "HTTP URLs must not contain newlines",
  });
const safariReadingListUrlSchema = httpCommandUrlSchema
  .refine((url) => textEncoder.encode(url).length <= READING_LIST_URL_MAX_BYTES, {
    message: `Reading List URL must be ${READING_LIST_URL_MAX_BYTES} UTF-8 bytes or less`,
  })
  .refine((url) => !controlCharPattern.test(url), {
    message: "Reading List URL must not contain control characters",
  })
  .refine((url) => !whitespacePattern.test(url), {
    message: "Reading List URL must not contain whitespace",
  })
  .refine((url) => !hasHttpUrlCredentials(url), {
    message: "Reading List URL must not contain credentials",
  });

export function normalizeHttpCommandUrl(value: string): string | null {
  const result = httpCommandUrlSchema.safeParse(value);

  return result.success ? result.data : null;
}

export function normalizeTagColorForCommand(value: string | null | undefined): string | null {
  if (value == null) {
    return null;
  }

  return nullableTagColorSchema.parse(value) ?? null;
}

export function normalizeTagColorForView(value: string | null | undefined): string | null {
  const result = nullableTagColorSchema.safeParse(value);
  return result.success ? (result.data ?? null) : null;
}

// --- listFolders / listFeeds ---
export const listFoldersArgs = z.object({ accountId: nonBlankTrimmedIdSchema });
export const listFeedsArgs = z.object({ accountId: nonBlankTrimmedIdSchema });

// --- listArticles ---
export const listArticlesArgs = z
  .object({
    feedId: nonBlankTrimmedIdSchema,
    unreadOnly: z.boolean().optional(),
    starredOnly: z.boolean().optional(),
    offset: paginationOffsetSchema.optional(),
    limit: paginationLimitSchema.optional(),
  })
  .refine((args) => !(args.unreadOnly === true && args.starredOnly === true), {
    message: "Article list filters are mutually exclusive",
    path: ["starredOnly"],
  });

// --- listAccountArticles ---
export const listAccountArticlesArgs = z.object({
  accountId: nonBlankTrimmedIdSchema,
  unreadOnly: z.boolean().optional(),
  offset: paginationOffsetSchema.optional(),
  limit: paginationLimitSchema.optional(),
});

// --- listFeedArticleSummaries ---
export const listFeedArticleSummariesArgs = z.object({
  accountId: nonBlankTrimmedIdSchema,
});

// --- listFolderArticles ---
export const listFolderArticlesArgs = z.object({
  folderId: nonBlankTrimmedIdSchema,
  mode: articleListModeSchema.optional(),
  offset: paginationOffsetSchema.optional(),
  limit: paginationLimitSchema.optional(),
});

// --- listStarredArticles ---
export const listStarredArticlesArgs = z.object({
  accountId: nonBlankTrimmedIdSchema,
  offset: paginationOffsetSchema.optional(),
  limit: paginationLimitSchema.optional(),
});

// --- listRecentArticles ---
export const listRecentArticlesArgs = z.object({
  accountId: nonBlankTrimmedIdSchema,
  mode: articleListModeSchema.optional(),
  offset: paginationOffsetSchema.optional(),
  limit: paginationLimitSchema.optional(),
});

// --- countAccountUnreadArticles ---
export const countAccountUnreadArticlesArgs = z.object({
  accountId: nonBlankTrimmedIdSchema,
});

// --- countAccountStarredArticles ---
export const countAccountStarredArticlesArgs = z.object({
  accountId: nonBlankTrimmedIdSchema,
});

const oldUnreadScopeKindSchema = z.enum(["account", "feed", "folder"]);
const oldUnreadDaysSchema = z.union([z.literal(7), z.literal(30), z.literal(90)]);
export type OldUnreadScopeKind = z.infer<typeof oldUnreadScopeKindSchema>;
export type OldUnreadDays = z.infer<typeof oldUnreadDaysSchema>;

// --- markAccountRead ---
export const markAccountReadArgs = z.object({ accountId: nonBlankTrimmedIdSchema });

// --- old unread articles ---
export const oldUnreadArticlesArgs = z.object({
  scopeKind: oldUnreadScopeKindSchema,
  targetId: nonBlankTrimmedIdSchema,
  olderThanDays: oldUnreadDaysSchema,
});

// --- unstarAccountArticles ---
export const unstarAccountArticlesArgs = z.object({ accountId: nonBlankTrimmedIdSchema });
export const cleanupFeedIntegrityOrphansArgs = z.object({ dryRun: z.boolean() });

// --- searchArticles ---
export const searchArticlesArgs = z.object({
  accountId: nonBlankTrimmedIdSchema,
  query: nonBlankTrimmedStringSchema,
  offset: paginationOffsetSchema.optional(),
  limit: paginationLimitSchema.optional(),
});

// --- markArticleRead ---
export const markArticleReadArgs = z.object({
  articleId: nonBlankTrimmedIdSchema,
  read: z.boolean().optional(),
});

// --- article view history ---
export const recordArticleViewArgs = z.object({
  accountId: nonBlankTrimmedIdSchema,
  articleId: nonBlankTrimmedIdSchema,
});

export const clearArticleViewHistoryArgs = z.object({
  accountId: nonBlankTrimmedIdSchema,
});

// --- markArticlesRead ---
export const markArticlesReadArgs = z.object({
  articleIds: z.array(nonBlankTrimmedIdSchema).nonempty(),
});

// --- toggleArticleStar ---
export const toggleArticleStarArgs = z.object({
  articleId: nonBlankTrimmedIdSchema,
  starred: z.boolean(),
});

// --- markFeedRead ---
export const markFeedReadArgs = z.object({ feedId: nonBlankTrimmedIdSchema });

// --- markFolderRead ---
export const markFolderReadArgs = z.object({ folderId: nonBlankTrimmedIdSchema });

// --- addAccount ---
const localAddAccountArgs = z.object({
  kind: z.literal("Local"),
  name: accountNameSchema,
  serverUrl: optionalBlankStringToUndefinedSchema,
  appId: optionalBlankStringToUndefinedSchema,
  appKey: optionalBlankStringToUndefinedSchema,
  username: optionalBlankStringToUndefinedSchema,
  password: optionalBlankStringToUndefinedSchema,
});
const freshRssAddAccountArgs = z.object({
  kind: z.literal("FreshRss"),
  name: accountNameSchema,
  serverUrl: z.string().trim().min(1),
  appId: z.string().optional(),
  appKey: z.string().optional(),
  username: z.string().trim().min(1),
  password: z.string().trim().min(1),
});
export const addAccountArgs = z.discriminatedUnion("kind", [localAddAccountArgs, freshRssAddAccountArgs]);

// --- updateAccountSync ---
const syncIntervalSecsSchema = z.number().int().min(60).max(86_400);
const keepReadItemsDaysSchema = z.number().int().min(1).max(3650);

export const updateAccountSyncArgs = z.object({
  accountId: nonBlankTrimmedIdSchema,
  syncIntervalSecs: syncIntervalSecsSchema,
  syncOnStartup: z.boolean(),
  syncOnWake: z.boolean(),
  keepReadItemsDays: keepReadItemsDaysSchema,
});

// --- updateAccountCredentials ---
export const updateAccountCredentialsArgs = z.object({
  accountId: nonBlankTrimmedIdSchema,
  serverUrl: optionalNonBlankTrimmedStringSchema,
  username: optionalNonBlankTrimmedStringSchema,
  password: z.string().optional(),
});

// --- renameAccount ---
export const renameAccountArgs = z.object({
  accountId: nonBlankTrimmedIdSchema,
  name: accountNameSchema,
});

// --- syncAccount ---
export const syncAccountArgs = z.object({ accountId: nonBlankTrimmedIdSchema });
export const getAccountSyncStatusArgs = z.object({ accountId: nonBlankTrimmedIdSchema });

// --- syncFeed ---
export const syncFeedArgs = z.object({ feedId: nonBlankTrimmedIdSchema });

// --- startup sync ---
export const startupSyncArgs = z.object({
  preferredAccountId: optionalBlankStringToUndefinedSchema,
});

// --- testAccountConnection ---
export const testAccountConnectionArgs = z.object({ accountId: nonBlankTrimmedIdSchema });

// --- deleteAccount ---
export const deleteAccountArgs = z.object({ accountId: nonBlankTrimmedIdSchema });

// --- discoverFeeds ---
export const discoverFeedsArgs = z.object({ url: httpCommandUrlSchema });

// --- addLocalFeed ---
export const addLocalFeedArgs = z.object({
  accountId: nonBlankTrimmedIdSchema,
  url: httpCommandUrlSchema,
});

// --- createFolder ---
export const createFolderArgs = z.object({
  accountId: nonBlankTrimmedIdSchema,
  name: folderNameSchema,
});

// --- deleteFeed ---
export const deleteFeedArgs = z.object({ feedId: nonBlankTrimmedIdSchema });

// --- renameFeed ---
export const renameFeedArgs = z.object({
  feedId: nonBlankTrimmedIdSchema,
  title: feedTitleSchema,
});

// --- updateFeedFolder ---
export const updateFeedFolderArgs = z.object({
  feedId: nonBlankTrimmedIdSchema,
  folderId: nullableBlankStringToNullSchema,
});

// --- updateFeedDisplaySettings ---
export const updateFeedDisplaySettingsArgs = z.object({
  feedId: nonBlankTrimmedIdSchema,
  readerMode: FeedDisplayModeSchema,
  webPreviewMode: FeedDisplayModeSchema,
});

const externalUrlSchema = z
  .string()
  .trim()
  .refine(
    (url) =>
      url.toLowerCase().startsWith("http://") ||
      url.toLowerCase().startsWith("https://") ||
      url.toLowerCase().startsWith("mailto:"),
    {
      message: "Only http://, https://, and mailto: URLs are supported",
    },
  )
  .refine((url) => !url.includes("\n") && !url.includes("\r"), {
    message: "External URLs must not contain newlines",
  })
  .refine((url) => !controlCharPattern.test(url), {
    message: "External URLs must not contain control characters",
  })
  .refine((url) => !whitespacePattern.test(url), {
    message: "External URLs must not contain whitespace",
  });
export const openExternalUrlArgs = z.object({ url: externalUrlSchema });

const readingListUrlSchema = httpCommandUrlSchema;

// --- checkBrowserEmbedSupport ---
export const checkBrowserEmbedSupportArgs = z.object({ url: readingListUrlSchema });

// --- browser webview ---
const finiteNumberSchema = z.number().finite();
const positiveFiniteNumberSchema = finiteNumberSchema.positive();

export const browserWebviewBoundsArgs = z.object({
  x: finiteNumberSchema,
  y: finiteNumberSchema,
  width: positiveFiniteNumberSchema,
  height: positiveFiniteNumberSchema,
  unit: z.enum(["logical", "physical"]).optional(),
});
export const createOrUpdateBrowserWebviewArgs = z.object({
  url: readingListUrlSchema,
  bounds: browserWebviewBoundsArgs,
});
export const setBrowserWebviewBoundsArgs = z.object({
  bounds: browserWebviewBoundsArgs,
});

// --- exportOpml ---
export const exportOpmlArgs = z.object({ accountId: nonBlankTrimmedIdSchema });

// --- setPreference ---
export const setPreferenceArgs = z
  .object({
    key: z.string(),
    value: z.string().refine((value) => textEncoder.encode(value).length <= preferenceValueMaxBytes, {
      message: `Preference value must be ${preferenceValueMaxBytes} UTF-8 bytes or less`,
    }),
  })
  .superRefine(({ key, value }, ctx) => {
    const schema = getPreferenceValueSchema(key);
    const result = schema?.safeParse(value);

    if (!schema && key.startsWith("shortcut_")) {
      ctx.addIssue({
        code: "custom",
        path: ["key"],
        message: `Invalid preference key: ${key}`,
      });
      return;
    }

    if (result?.success === false) {
      ctx.addIssue({
        code: "custom",
        path: ["value"],
        message: `Invalid value for preference key: ${key}`,
      });
    }
  });

// --- copyToClipboard ---
export const copyToClipboardArgs = z.object({
  text: z
    .string()
    .refine((value) => value.trim().length > 0, {
      message: "Clipboard text must not be blank",
    })
    .refine((value) => !controlCharPattern.test(value), {
      message: "Clipboard text must not contain control characters",
    })
    .refine((value) => countGraphemes(value) <= SHARE_COMMAND_TEXT_MAX_CHARS, {
      message: `Clipboard text must be ${SHARE_COMMAND_TEXT_MAX_CHARS} graphemes or less`,
    })
    .refine((value) => textEncoder.encode(value).length <= SHARE_COMMAND_TEXT_MAX_BYTES, {
      message: `Clipboard text must be ${SHARE_COMMAND_TEXT_MAX_BYTES} UTF-8 bytes or less`,
    }),
});

// --- openInBrowser ---
export const openInBrowserArgs = z.object({
  url: readingListUrlSchema,
  background: z.boolean().optional(),
});

// --- addToReadingList ---
export const addToReadingListArgs = z.object({
  url: safariReadingListUrlSchema,
});

// --- createTag ---
export const createTagArgs = z.object({
  name: tagNameSchema,
  color: optionalTagColorSchema,
});

// --- renameTag ---
export const renameTagArgs = z.object({
  tagId: nonBlankTrimmedIdSchema,
  name: tagNameSchema,
  color: nullableTagColorSchema,
});

// --- deleteTag ---
export const deleteTagArgs = z.object({ tagId: nonBlankTrimmedIdSchema });

// --- tagArticle ---
export const tagArticleArgs = z.object({
  articleId: nonBlankTrimmedIdSchema,
  tagId: nonBlankTrimmedIdSchema,
});

// --- untagArticle ---
export const untagArticleArgs = z.object({
  articleId: nonBlankTrimmedIdSchema,
  tagId: nonBlankTrimmedIdSchema,
});

// --- getArticleTags ---
export const getArticleTagsArgs = z.object({ articleId: nonBlankTrimmedIdSchema });

// --- listArticlesByTag ---
export const listArticlesByTagArgs = z.object({
  tagId: nonBlankTrimmedIdSchema,
  mode: articleListModeSchema.optional(),
  offset: paginationOffsetSchema.optional(),
  limit: paginationLimitSchema.optional(),
  accountId: nonBlankTrimmedIdSchema.optional(),
});

// --- getTagArticleCounts ---
export const getTagArticleCountsArgs = z.object({
  accountId: nonBlankTrimmedIdSchema.optional(),
});

// --- mute keywords ---
export const createMuteKeywordArgs = z.object({
  keyword: nonBlankTrimmedStringSchema,
  scope: MuteKeywordScopeSchema,
});

export const deleteMuteKeywordArgs = z.object({
  muteKeywordId: nonBlankTrimmedIdSchema,
});

export const updateMuteKeywordArgs = z.object({
  muteKeywordId: nonBlankTrimmedIdSchema,
  scope: MuteKeywordScopeSchema,
});

export const setMuteAutoMarkReadArgs = z.object({
  enabled: z.boolean(),
});

type CommandArgsSchema = z.ZodType<Record<string, unknown>>;

// Registry: command names (snake_case) -> schema (only commands with args)
export const commandArgsSchemas = {
  list_folders: listFoldersArgs,
  list_feeds: listFeedsArgs,
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
