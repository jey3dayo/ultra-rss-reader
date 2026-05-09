import { describe, expect, expectTypeOf, it } from "vitest";
import type {
  AccountDto,
  AccountSyncError,
  AccountSyncStatusDto,
  AccountSyncWarning,
  AppError,
  ArticleDto,
  BrowserWebviewState,
  DatabaseInfoDto,
  DevRuntimeOptions,
  DiscoveredFeedDto,
  FeedArticleSummaryDto,
  FeedDto,
  FeedIntegrityCleanupDto,
  FeedIntegrityReportDto,
  FolderDto,
  MuteKeywordDto,
  MuteKeywordScope,
  OldUnreadDays,
  OldUnreadScopeKind,
  PlatformInfo,
  SyncResultDto,
  TagDto,
  UpdateInfoDto,
} from "@/api/schemas";
import * as apiSchemas from "@/api/schemas";
import {
  BooleanResponseSchema,
  CountResponseSchema,
  IntResponseSchema,
  NonnegativeIntegerSchema,
  NonnegativeIntResponseSchema,
  NullResponseSchema,
  StringResponseSchema,
} from "@/api/schemas/common";

const publicSchemaRuntimeExports = [
  "AccountDtoListSchema",
  "AccountDtoSchema",
  "AccountSyncStatusSchema",
  "AppErrorSchema",
  "ArticleDtoListSchema",
  "ArticleDtoSchema",
  "BooleanResponseSchema",
  "BrowserWebviewDiagnosticsPayloadSchema",
  "BrowserWebviewFallbackPayloadSchema",
  "BrowserWebviewStateSchema",
  "CountResponseSchema",
  "DatabaseInfoDtoSchema",
  "DevRuntimeOptionsSchema",
  "DiscoveredFeedDtoListSchema",
  "DiscoveredFeedDtoSchema",
  "FeedArticleSummaryDtoListSchema",
  "FeedArticleSummaryDtoSchema",
  "FeedDtoListSchema",
  "FeedDtoSchema",
  "FeedIntegrityCleanupDtoSchema",
  "FeedIntegrityReportDtoSchema",
  "FolderDtoListSchema",
  "FolderDtoSchema",
  "IntResponseSchema",
  "MAX_IPC_PAGINATION_LIMIT",
  "MuteKeywordDtoListSchema",
  "MuteKeywordDtoSchema",
  "MuteKeywordScopeSchema",
  "NonnegativeIntResponseSchema",
  "NullResponseSchema",
  "NullableStarredArticlesSchema",
  "NullableStarredCountSchema",
  "PlatformInfoSchema",
  "PreferencesDtoSchema",
  "StringResponseSchema",
  "SyncResultSchema",
  "TagArticleCountsSchema",
  "TagDtoListSchema",
  "TagDtoSchema",
  "UpdateInfoDtoSchema",
  "addAccountArgs",
  "addLocalFeedArgs",
  "addToReadingListArgs",
  "browserWebviewBoundsArgs",
  "checkBrowserEmbedSupportArgs",
  "cleanupFeedIntegrityOrphansArgs",
  "clearArticleViewHistoryArgs",
  "commandArgsSchemas",
  "copyToClipboardArgs",
  "countAccountStarredArticlesArgs",
  "countAccountUnreadArticlesArgs",
  "createFolderArgs",
  "createMuteKeywordArgs",
  "createOrUpdateBrowserWebviewArgs",
  "createTagArgs",
  "deleteAccountArgs",
  "deleteFeedArgs",
  "deleteMuteKeywordArgs",
  "deleteTagArgs",
  "discoverFeedsArgs",
  "exportOpmlArgs",
  "getAccountSyncStatusArgs",
  "getArticleTagsArgs",
  "getCommandArgsSchema",
  "getTagArticleCountsArgs",
  "isCommandWithArgs",
  "listAccountArticlesArgs",
  "listArticlesArgs",
  "listArticlesByTagArgs",
  "listFeedArticleSummariesArgs",
  "listFeedsArgs",
  "listFolderArticlesArgs",
  "listFoldersArgs",
  "listRecentArticlesArgs",
  "listStarredArticlesArgs",
  "markAccountReadArgs",
  "markArticleReadArgs",
  "markArticlesReadArgs",
  "markFeedReadArgs",
  "markFolderReadArgs",
  "oldUnreadArticlesArgs",
  "openExternalUrlArgs",
  "openInBrowserArgs",
  "recordArticleViewArgs",
  "renameAccountArgs",
  "renameFeedArgs",
  "renameTagArgs",
  "searchArticlesArgs",
  "setBrowserWebviewBoundsArgs",
  "setMuteAutoMarkReadArgs",
  "setPreferenceArgs",
  "startupSyncArgs",
  "syncAccountArgs",
  "syncFeedArgs",
  "tagArticleArgs",
  "testAccountConnectionArgs",
  "toggleArticleStarArgs",
  "unstarAccountArticlesArgs",
  "untagArticleArgs",
  "updateAccountCredentialsArgs",
  "updateAccountSyncArgs",
  "updateFeedDisplaySettingsArgs",
  "updateFeedFolderArgs",
  "updateMuteKeywordArgs",
] as const satisfies readonly (keyof typeof apiSchemas)[];

const publicTauriCommandSchemaBoundaryExports = [
  "DevRuntimeOptionsSchema",
  "FeedIntegrityCleanupDtoSchema",
  "FeedIntegrityReportDtoSchema",
  "MAX_IPC_PAGINATION_LIMIT",
  "PlatformInfoSchema",
  "commandArgsSchemas",
  "getCommandArgsSchema",
  "isCommandWithArgs",
] as const satisfies readonly (typeof publicSchemaRuntimeExports)[number][];

type PublicSchemaTypeContracts = readonly [
  AccountDto,
  AccountSyncError,
  AccountSyncStatusDto,
  AccountSyncWarning,
  AppError,
  ArticleDto,
  BrowserWebviewState,
  DatabaseInfoDto,
  DevRuntimeOptions,
  DiscoveredFeedDto,
  FeedArticleSummaryDto,
  FeedDto,
  FeedIntegrityCleanupDto,
  FeedIntegrityReportDto,
  FolderDto,
  MuteKeywordDto,
  MuteKeywordScope,
  OldUnreadDays,
  OldUnreadScopeKind,
  PlatformInfo,
  SyncResultDto,
  TagDto,
  UpdateInfoDto,
];

describe("schema barrel public API", () => {
  it("keeps runtime exports intentionally public through the schema barrel", () => {
    expect(Object.keys(apiSchemas).sort()).toEqual(
      [...publicSchemaRuntimeExports].sort(),
    );
  });

  it("keeps Tauri command schema boundary exports intentionally public", () => {
    expect(
      publicTauriCommandSchemaBoundaryExports.every(
        (exportName) => exportName in apiSchemas,
      ),
    ).toBe(true);
  });

  it("keeps shared nonnegative integer schema internal while preserving public response schemas", () => {
    expect("NonnegativeIntegerSchema" in apiSchemas).toBe(false);
    expect(apiSchemas.CountResponseSchema.parse(0)).toBe(0);
    expect(apiSchemas.NonnegativeIntResponseSchema.parse(0)).toBe(0);
    expect(NonnegativeIntegerSchema.parse(0)).toBe(0);
    expect(apiSchemas.CountResponseSchema).not.toBe(
      apiSchemas.NonnegativeIntResponseSchema,
    );
    expect(apiSchemas.CountResponseSchema).not.toBe(NonnegativeIntegerSchema);
  });

  it("keeps response schema names available through both public schema import paths", () => {
    expect(apiSchemas.NullResponseSchema).toBe(NullResponseSchema);
    expect(apiSchemas.IntResponseSchema).toBe(IntResponseSchema);
    expect(apiSchemas.NonnegativeIntResponseSchema).toBe(
      NonnegativeIntResponseSchema,
    );
    expect(apiSchemas.CountResponseSchema).toBe(CountResponseSchema);
    expect(apiSchemas.StringResponseSchema).toBe(StringResponseSchema);
    expect(apiSchemas.BooleanResponseSchema).toBe(BooleanResponseSchema);
  });

  it("keeps DTO and command helper type exports intentionally public through the schema barrel", () => {
    expectTypeOf<PublicSchemaTypeContracts>().toEqualTypeOf<PublicSchemaTypeContracts>();
  });
});
