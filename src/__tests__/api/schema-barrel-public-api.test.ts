import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expectSortedKeysForTarget } from "@tests/helpers/repo-contract-parser";
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
  SyncCompletedPayload,
  SyncProgressEventDto,
  SyncProgressRuntimeEventDto,
  SyncResultDto,
  SyncWarningPayload,
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
  "APP_ERROR_MESSAGE_MAX_CHARS",
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
  "COUNT_RESPONSE_MAX_VALUE",
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
  "FRONTEND_SCHEMA_CONTRACT_VERSION",
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
  "PlatformPermissionDeniedRecoveryListSchema",
  "PlatformPermissionDeniedRecoverySchema",
  "PreferencesDtoSchema",
  "SettingsProfileImportResultSchema",
  "SettingsProfileSchema",
  "StringResponseSchema",
  "SyncCompletedPayloadSchema",
  "SyncProgressEventSchema",
  "SyncResultSchema",
  "SyncWarningPayloadSchema",
  "QUERY_CACHE_KEY_VERSION",
  "SCHEMA_PARSE_FAILURE_ACTION_STATE",
  "TagArticleCountsSchema",
  "TagDtoListSchema",
  "TagDtoSchema",
  "UpdateInfoDtoSchema",
  "browserWebviewBoundsArgs",
  "commandArgsSchemas",
  "createSchemaVersionedQueryKey",
  "getCommandArgsSchema",
  "isCommandWithArgs",
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

const publicCommandArgSchemaExports = [
  ...new Set(Object.keys(apiSchemas.commandArgsSchemas).map(toCommandArgExportName)),
];

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

const schemaFilesCoveredByAggregateTests = [
  "account-sync-status",
  "account",
  "article",
  "browser-webview",
  "commands",
  "common",
  "discovered-feed",
  "error",
  "feed-article-summary",
  "feed",
  "folder",
  "mute-keyword",
  "preferences",
  "runtime-contracts",
  "settings-profile",
  "starred-articles",
  "sync-progress",
  "tag",
] as const;

const expectedSchemaFileStems = [
  ...schemaFilesCoveredByAggregateTests,
  "database-info",
  "feed-integrity",
  "platform-info",
  "sync-result",
  "update-info",
] as const;

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
  SyncCompletedPayload,
  SyncProgressEventDto,
  SyncProgressRuntimeEventDto,
  SyncResultDto,
  SyncWarningPayload,
  TagDto,
  UpdateInfoDto,
];

function readSource(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

function readDirectoryFileStems(path: string) {
  return readdirSync(join(process.cwd(), path))
    .filter((fileName) => fileName.endsWith(".ts"))
    .map((fileName) => fileName.replace(/\.ts$/, ""))
    .filter((fileName) => fileName !== "index")
    .toSorted();
}

function extractSchemaBarrelExportTargets(source: string) {
  return [...source.matchAll(/from "\.\/([^"]+)";/g)]
    .map((match) => match[1])
    .filter(Boolean)
    .toSorted();
}

function toSchemaTestFilePath(schemaFileStem: string) {
  return `src/__tests__/api/schemas/${schemaFileStem}.test.ts`;
}

describe("schema barrel public API", () => {
  it("keeps runtime exports intentionally public through the schema barrel", () => {
    expectSortedKeysForTarget("@/api/schemas barrel", Object.keys(apiSchemas), [
      ...publicSchemaRuntimeExports,
      ...publicCommandArgSchemaExports,
    ]);
  });

  it("keeps Tauri command schema boundary exports intentionally public", () => {
    expect(publicTauriCommandSchemaBoundaryExports.every((exportName) => exportName in apiSchemas)).toBe(true);
  });

  it("keeps shared nonnegative integer schema internal while preserving public response schemas", () => {
    expect("NonnegativeIntegerSchema" in apiSchemas).toBe(false);
    expect(apiSchemas.CountResponseSchema.parse(0)).toBe(0);
    expect(apiSchemas.NonnegativeIntResponseSchema.parse(0)).toBe(0);
    expect(NonnegativeIntegerSchema.parse(0)).toBe(0);
    expect(apiSchemas.CountResponseSchema).not.toBe(apiSchemas.NonnegativeIntResponseSchema);
    expect(apiSchemas.CountResponseSchema).not.toBe(NonnegativeIntegerSchema);
  });

  it("keeps response schema names available through both public schema import paths", () => {
    expect(apiSchemas.NullResponseSchema).toBe(NullResponseSchema);
    expect(apiSchemas.IntResponseSchema).toBe(IntResponseSchema);
    expect(apiSchemas.NonnegativeIntResponseSchema).toBe(NonnegativeIntResponseSchema);
    expect(apiSchemas.CountResponseSchema).toBe(CountResponseSchema);
    expect(apiSchemas.StringResponseSchema).toBe(StringResponseSchema);
    expect(apiSchemas.BooleanResponseSchema).toBe(BooleanResponseSchema);
  });

  it("keeps DTO and command helper type exports intentionally public through the schema barrel", () => {
    expectTypeOf<PublicSchemaTypeContracts>().toEqualTypeOf<PublicSchemaTypeContracts>();
  });

  it("keeps every API schema file either barrel-exported or intentionally internal", () => {
    const schemaFileStems = readDirectoryFileStems("src/api/schemas");
    const schemaBarrelExportTargets = extractSchemaBarrelExportTargets(readSource("src/api/schemas/index.ts"));

    expectSortedKeysForTarget("src/api/schemas files", schemaFileStems, expectedSchemaFileStems);
    expectSortedKeysForTarget("src/api/schemas barrel export targets", schemaBarrelExportTargets, schemaFileStems);
  });

  it("keeps schema-specific test coverage explicit for new API schema files", () => {
    const dedicatedSchemaTestStems = readDirectoryFileStems("src/__tests__/api/schemas").map((fileName) =>
      fileName.replace(/\.test$/, ""),
    );
    const coveredSchemaFileStems = [...schemaFilesCoveredByAggregateTests, ...dedicatedSchemaTestStems].toSorted();

    expectSortedKeysForTarget("schema files with dedicated or aggregate tests", coveredSchemaFileStems, [
      ...expectedSchemaFileStems,
    ]);
    expect(dedicatedSchemaTestStems.map(toSchemaTestFilePath)).toEqual([
      "src/__tests__/api/schemas/database-info.test.ts",
      "src/__tests__/api/schemas/feed-integrity.test.ts",
      "src/__tests__/api/schemas/platform-info.test.ts",
      "src/__tests__/api/schemas/sync-result.test.ts",
      "src/__tests__/api/schemas/update-info.test.ts",
    ]);
  });
});
