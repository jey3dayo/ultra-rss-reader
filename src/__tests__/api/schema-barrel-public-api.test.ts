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
  "browserWebviewBoundsArgs",
] as const satisfies readonly (keyof typeof apiSchemas)[];

const commandArgExportNameOverrides = new Map<string, string>([
  ["count_old_unread_articles", "oldUnreadArticlesArgs"],
  ["mark_account_starred_read", "markAccountReadArgs"],
  ["mark_old_unread_read", "oldUnreadArticlesArgs"],
  ["plugin:opener|open_url", "openExternalUrlArgs"],
  ["trigger_startup_sync", "startupSyncArgs"],
  ["trigger_sync_account", "syncAccountArgs"],
  ["trigger_sync_feed", "syncFeedArgs"],
]);

const toCommandArgExportName = (commandName: string): string => {
  const override = commandArgExportNameOverrides.get(commandName);
  if (override) {
    return override;
  }

  const camelName = commandName.replace(/_([a-z])/g, (_, char: string) => char.toUpperCase());
  return `${camelName}Args`;
};

const publicCommandArgSchemaExports = [...new Set(Object.keys(apiSchemas.commandArgsSchemas).map(toCommandArgExportName))];

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
      [...publicSchemaRuntimeExports, ...publicCommandArgSchemaExports].sort(),
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
