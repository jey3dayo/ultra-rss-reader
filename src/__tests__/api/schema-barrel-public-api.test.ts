import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expectSortedKeysForTarget } from "@tests/helpers/repo-contract-parser";
import { parse } from "valibot";
import { describe, expect, it } from "vitest";
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

const commandArgExportNameOverrides = new Map<string, string>([
  ["count_old_unread_articles", "oldUnreadArticlesArgs"],
  ["mark_account_starred_read", "markAccountReadArgs"],
  ["mark_old_unread_read", "oldUnreadArticlesArgs"],
  ["plugin:opener|open_url", "openExternalUrlArgs"],
  ["preview_settings_profile_import", "importSettingsProfileArgs"],
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
  "local-account-sync",
  "local-feed-sync-status",
  "mute-keyword",
  "preferences",
  "remote-feed-sync-status",
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

describe("schema barrel public API", () => {
  it("keeps command argument schemas public through the schema barrel", () => {
    const barrelExportNames = new Set(Object.keys(apiSchemas));

    expect(publicCommandArgSchemaExports.filter((exportName) => !barrelExportNames.has(exportName))).toEqual([]);
  });

  it("keeps shared nonnegative integer schema internal while preserving public response schemas", () => {
    expect("NonnegativeIntegerSchema" in apiSchemas).toBe(false);
    expect(parse(apiSchemas.CountResponseSchema, 0)).toBe(0);
    expect(parse(apiSchemas.NonnegativeIntResponseSchema, 0)).toBe(0);
    expect(parse(NonnegativeIntegerSchema, 0)).toBe(0);
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

  it("keeps every API schema file either barrel-exported or intentionally internal", () => {
    const schemaFileStems = readDirectoryFileStems("src/api/schemas").filter((stem) => stem !== "validation");
    const schemaBarrelExportTargets = extractSchemaBarrelExportTargets(readSource("src/api/schemas/index.ts"));

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
  });
});
