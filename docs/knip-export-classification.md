---
type: record
title: Knip Export And Type Classification
description: Dated triage record classifying the 73 Knip unused-export and unused-type findings from Issue #249, with the rationale and action for each.
resource: urn:ultra-rss-reader:docs:knip-export-classification
tags: [category/quality, audience/agent, audience/developer, status/historical]
timestamp: 2026-09-08
audience: agent, developer
owner: project-maintainers
---

# Knip Export And Type Classification

Triage record for the `exports` (44) and `types` (29) findings reported by
`pnpm exec knip --reporter json --no-exit-code --no-progress` on `origin/main` at `de06e2a5f`,
covering Issue #249. The durable half of this record — the standing false positive and the
method — lives in [../.claude/rules/quality-policy.md](../.claude/rules/quality-policy.md).
Everything else below is a historical snapshot of resolved findings; do not treat the table as a
list of code that still exists.

## Result

| Classification | Count | Action taken |
| --- | --- | --- |
| false-positive | 1 | Left as-is; a real consumer exists that Knip cannot model |
| accepted-risk | 1 | Left as-is; no production caller, but a test pins the surface |
| narrow | 61 | `export` modifier dropped, or the name dropped from a re-export list |
| remove | 10 | Definition deleted |

Knip findings before: 82 (7 files, 44 exports, 29 types, 2 duplicates).
Knip findings after: 11 (7 files, 2 exports, 2 duplicates). The 7 file findings and the 2 duplicate
findings were out of scope and are unchanged.

`scripts/quality-baseline.ts` was deliberately not updated; the baseline constants are refreshed
separately once the whole Issue #249 classification lands.

## Method

Reference counts alone did not decide any row. Three checks ran per finding:

1. **Import specifier, not name co-occurrence.** For every file mentioning the name, the enclosing
   `import`/`export ... from "…"` specifier was resolved. This is what separates a live barrel entry
   from a dead pass-through: a name can appear in ten files that all import it from the *owner*
   module rather than from the re-exporting one. Fifteen of the sixteen `src/schemas/preferences.ts`
   re-export rows, all four `src/api/tauri-commands/types.ts` rows, and all seven
   `tests/helpers/api-fixtures.ts` rows resolved this way.
2. **Source-text (`?raw`) contracts.** Every test importing a source file as text was enumerated and
   searched for the 73 names. Exactly one hit: `corePreferenceDefaults`, whose contract regex
   includes the literal `export` keyword. A second, different form of the same problem only showed up
   when the gate ran: `tests/helpers/tauri-mocks.node.test.ts` extracts frontend command strings from
   `src/api/tauri-commands/*.ts` source and pins them against the default mock set, so a wrapper with
   no import-graph caller can still be pinned by its own source text.
3. **In-file use (`own_occurrences`).** A name used inside its own file can be narrowed; a name whose
   only occurrence is its own definition cannot — dropping `export` there produces an unused local
   that `tsc --noUnusedLocals` rejects. That is the narrow/remove split, not a judgement about how
   valuable the code looks.

Two things were explicitly *not* treated as evidence for keeping an export:

- A mirrored Rust constant, DTO, command, or capability entry. That is a Rust-side contract. Only a
  TypeScript consumer — including a test that reads the `.rs` file as text and compares — would count.
- "We might need it later." No row was kept on that basis.

The design-system barrel completeness precedent in `quality-policy.md` was likewise not generalised
to the schema modules. Each schema owner was checked for an actual pinned public surface instead;
`src/api/schemas/index.ts` has one (`schema-barrel-public-api.test.ts`), and none of these 73 names
are in it.

## Findings

`kind` is the Knip bucket the finding came from.

| Location | Name | Kind | Classification | Rationale |
| --- | --- | --- | --- | --- |
| `scripts/lib/windows-dispatch.ts:36` | `WindowsDispatchEnvKey` | types | remove | No reference anywhere, including in-file. `WINDOWS_DISPATCH_ENV_SCHEMA` and `WindowsDispatchEnvSchema` carry the allowlist contract. |
| `scripts/repo-contract-inventory.ts:20` | `MigrationInventory` | types | narrow | Used throughout the same file (`addColumn`, `createEmptyMigrationInventory`, `hasColumnInAnyTable`, the report type). |
| `scripts/repo-contract-inventory.ts:26` | `RepositorySqlReference` | types | narrow | Used in-file by `RepositorySqlInventoryReport.references`. |
| `scripts/repo-contract-inventory.ts:191` | `parseMigrationInventory` | exports | narrow | Called in-file by the inventory builder. |
| `scripts/tauri-cli-dispatch.ts:198` | `normalizeChildEnvForPlatform` | exports | narrow | Called in-file when building the child process environment. |
| `src/api/schemas/browser-webview.ts:67` | `BrowserWebviewDebugInputPayload` | types | remove | `InferOutput` alias of `BrowserWebviewDebugInputPayloadSchema` (which is used) with no reference anywhere, including in-file. Nothing to narrow to. |
| `src/api/schemas/commands/index.ts:30` | `httpCommandUrlSchema` | exports | narrow | Barrel re-export nobody reaches. `src/api/schemas/commands/feed-folder.ts` imports it from `./url` directly. `normalizeHttpCommandUrl` on the same line is still consumed through the barrel and stays. |
| `src/api/schemas/commands/read-diagnostics.ts:11` | `READ_DIAGNOSTIC_REQUEST_ID_MAX_CHARS` | exports | narrow | Used in the same file (request-id RegExp, batch `maxLength`, the `ReadDiagnostic*` `InferOutput` aliases, `recordReadDiagnosticsBatchArgs`). Nothing imports it through `@/api/schemas/commands`. The Rust mirrors in `src-tauri/src/commands/dto/read_diagnostics.rs` and the "Mirrors ..." comment in `read-state-diagnostics.ts` are prose/parallel constants, not TypeScript consumers, so they do not require the export. |
| `src/api/schemas/commands/read-diagnostics.ts:13` | `READ_DIAGNOSTICS_BATCH_MAX_EVENTS` | exports | narrow | Used in the same file (request-id RegExp, batch `maxLength`, the `ReadDiagnostic*` `InferOutput` aliases, `recordReadDiagnosticsBatchArgs`). Nothing imports it through `@/api/schemas/commands`. The Rust mirrors in `src-tauri/src/commands/dto/read_diagnostics.rs` and the "Mirrors ..." comment in `read-state-diagnostics.ts` are prose/parallel constants, not TypeScript consumers, so they do not require the export. |
| `src/api/schemas/commands/read-diagnostics.ts:28` | `readDiagnosticSkipReasonSchema` | exports | narrow | Used in the same file (request-id RegExp, batch `maxLength`, the `ReadDiagnostic*` `InferOutput` aliases, `recordReadDiagnosticsBatchArgs`). Nothing imports it through `@/api/schemas/commands`. The Rust mirrors in `src-tauri/src/commands/dto/read_diagnostics.rs` and the "Mirrors ..." comment in `read-state-diagnostics.ts` are prose/parallel constants, not TypeScript consumers, so they do not require the export. |
| `src/api/schemas/commands/read-diagnostics.ts:35` | `readDiagnosticCancelReasonSchema` | exports | narrow | Used in the same file (request-id RegExp, batch `maxLength`, the `ReadDiagnostic*` `InferOutput` aliases, `recordReadDiagnosticsBatchArgs`). Nothing imports it through `@/api/schemas/commands`. The Rust mirrors in `src-tauri/src/commands/dto/read_diagnostics.rs` and the "Mirrors ..." comment in `read-state-diagnostics.ts` are prose/parallel constants, not TypeScript consumers, so they do not require the export. |
| `src/api/schemas/commands/read-diagnostics.ts:42` | `readDiagnosticOutcomeSchema` | exports | narrow | Used in the same file (request-id RegExp, batch `maxLength`, the `ReadDiagnostic*` `InferOutput` aliases, `recordReadDiagnosticsBatchArgs`). Nothing imports it through `@/api/schemas/commands`. The Rust mirrors in `src-tauri/src/commands/dto/read_diagnostics.rs` and the "Mirrors ..." comment in `read-state-diagnostics.ts` are prose/parallel constants, not TypeScript consumers, so they do not require the export. |
| `src/api/schemas/commands/read-diagnostics.ts:43` | `readDiagnosticErrorClassSchema` | exports | narrow | Used in the same file (request-id RegExp, batch `maxLength`, the `ReadDiagnostic*` `InferOutput` aliases, `recordReadDiagnosticsBatchArgs`). Nothing imports it through `@/api/schemas/commands`. The Rust mirrors in `src-tauri/src/commands/dto/read_diagnostics.rs` and the "Mirrors ..." comment in `read-state-diagnostics.ts` are prose/parallel constants, not TypeScript consumers, so they do not require the export. |
| `src/api/schemas/commands/read-diagnostics.ts:107` | `readDiagnosticEventArgs` | exports | narrow | Used in the same file (request-id RegExp, batch `maxLength`, the `ReadDiagnostic*` `InferOutput` aliases, `recordReadDiagnosticsBatchArgs`). Nothing imports it through `@/api/schemas/commands`. The Rust mirrors in `src-tauri/src/commands/dto/read_diagnostics.rs` and the "Mirrors ..." comment in `read-state-diagnostics.ts` are prose/parallel constants, not TypeScript consumers, so they do not require the export. |
| `src/api/schemas/commands/shared.ts:49` | `tagColorSchema` | exports | narrow | Used in-file by `optionalTagColorSchema`. `src/api/schemas/tag.ts` and `settings-profile.ts` each declare their own local `tagColorSchema` (nullable variants), so the name co-occurrence there is not a consumer. |
| `src/api/schemas/settings-profile.ts:19` | `SettingsProfileAccountSchema` | exports | narrow | Composed into `SettingsProfileSchema` in the same file. `src/api/schemas/index.ts` re-exports only the composed schema. |
| `src/api/schemas/settings-profile.ts:31` | `SettingsProfileTagSchema` | exports | narrow | Composed into `SettingsProfileSchema` in the same file. `src/api/schemas/index.ts` re-exports only the composed schema. |
| `src/api/schemas/settings-profile.ts:36` | `SettingsProfileMuteKeywordSchema` | exports | narrow | Composed into `SettingsProfileSchema` in the same file. `src/api/schemas/index.ts` re-exports only the composed schema. |
| `src/api/schemas/sync-result.ts:10` | `SyncIssueOwnerSchema` | exports | narrow | Composed into `AccountSyncErrorSchema` / `AccountSyncWarningSchema` in the same file; not in the `src/api/schemas/index.ts` export list. |
| `src/api/tauri-commands/system.ts:17` | `getPlatformPermissionDeniedRecovery` | exports | accepted-risk | No production caller, but `tests/helpers/tauri-mocks.node.test.ts` extracts the frontend command set from this wrapper source and pins it against the default mock set; `src/dev/mocks.ts` supplies a browser-mode response and the `debug-log-commands` capability allowlist exposes the command, so three surfaces agree with the wrapper. Deleting it made that parity test fail. The justification is the TypeScript mock-parity test, **not** the existence of the Rust command/DTO. Narrowing is impossible (`own_occurrences == 1`), so the wrapper stays exported with a comment recording why. |
| `src/api/tauri-commands/types.ts:13` | `FeedIntegrityCleanupDto` | types | narrow | Compatibility re-export (`export type * from "./tauri-commands/types"` in `src/api/tauri-commands.ts`) that nothing reaches through. Every consumer imports the name from `@/api/schemas` (e.g. `src/stores/platform-store.ts`, `src/api/schemas/index.ts`, `src/__tests__/api/schema-barrel-public-api.test.ts`). The other 18 names in the same list are still consumed through `@/api/tauri-commands`, so the compat module stays. |
| `src/api/tauri-commands/types.ts:14` | `FeedIntegrityReportDto` | types | narrow | Compatibility re-export (`export type * from "./tauri-commands/types"` in `src/api/tauri-commands.ts`) that nothing reaches through. Every consumer imports the name from `@/api/schemas` (e.g. `src/stores/platform-store.ts`, `src/api/schemas/index.ts`, `src/__tests__/api/schema-barrel-public-api.test.ts`). The other 18 names in the same list are still consumed through `@/api/tauri-commands`, so the compat module stays. |
| `src/api/tauri-commands/types.ts:19` | `PlatformInfo` | types | narrow | Compatibility re-export (`export type * from "./tauri-commands/types"` in `src/api/tauri-commands.ts`) that nothing reaches through. Every consumer imports the name from `@/api/schemas` (e.g. `src/stores/platform-store.ts`, `src/api/schemas/index.ts`, `src/__tests__/api/schema-barrel-public-api.test.ts`). The other 18 names in the same list are still consumed through `@/api/tauri-commands`, so the compat module stays. |
| `src/api/tauri-commands/types.ts:20` | `PlatformPermissionDeniedRecovery` | types | narrow | Compatibility re-export (`export type * from "./tauri-commands/types"` in `src/api/tauri-commands.ts`) that nothing reaches through. Every consumer imports the name from `@/api/schemas` (e.g. `src/stores/platform-store.ts`, `src/api/schemas/index.ts`, `src/__tests__/api/schema-barrel-public-api.test.ts`). The other 18 names in the same list are still consumed through `@/api/tauri-commands`, so the compat module stays. |
| `src/constants/storage.ts:55` | `LegacyStorageKeyName` | types | narrow | Used in-file by `LegacyStorageKey`, which stays exported. The legacy-key contract is carried by `LEGACY_STORAGE_KEYS` and `LegacyStorageKey`, both still public. |
| `src/schemas/app-config.ts:87` | `TauriCapabilityPermissionSchema` | exports | narrow | Composed into `TauriCapabilitySchema` in the same file. |
| `src/schemas/app-config.ts:96` | `TauriCapabilitySchema` | exports | narrow | Composed into `TauriCapabilityFileSchema` in the same file. |
| `src/schemas/app-config.ts:104` | `TauriCapabilityPermission` | types | remove | Unused `InferOutput` alias with no in-file reference. |
| `src/schemas/app-config.ts:106` | `TauriCapabilityFile` | types | remove | Unused `InferOutput` alias. `tests/release-repo-contract.node.test.ts`, `scripts/check-release-build-contamination.ts`, and `scripts/release/validate-release-config.ts` each declare their own local `type TauriCapabilityFile`, so the name co-occurrence there is not a consumer. Converging those three onto this alias is a separate decision, not a Knip finding. |
| `src/schemas/preference-values.ts:45` | `DebugAgentationVisibilityPreference` | types | narrow | Used in-file by `PreferenceValueMap`; the only external reference was the `preferences.ts` re-export removed above. |
| `src/schemas/preference-values.ts:52` | `reservedUnknownPreferenceKeyPrefixes` | exports | narrow | Used in-file by `isReservedUnknownPreferenceKey`; the only external reference was the `preferences.ts` re-export removed above. |
| `src/schemas/preference-values.ts:170` | `hiddenPreferenceDefaultKeys` | exports | narrow | Used in-file by `HiddenPreferenceKey` and `hiddenPreferenceDefaultKeySet`. The exported type stays public; the array does not need to be. |
| `src/schemas/preference-values.ts:199` | `corePreferenceDefaults` | exports | false-positive | Real consumer Knip cannot model: `src/__tests__/schemas/preferences-schema-contract.test.ts` imports this module with `?raw` and matches the source text `/export const corePreferenceDefaults = \{([\s\S]*?)\} as const/` (plus `expect(preferenceValuesSource).toContain("corePreferenceDefaults")`). The literal `export` keyword is part of that contract, so the modifier must stay. Left unchanged; this is the one finding still reported by Knip. |
| `src/schemas/preferences.ts:29` | `AfterReadingPreference` | types | narrow | `@/schemas/preferences` re-export only. Every consumer imports this name from `@/schemas/preference-values` directly (`src/stores/preferences-store.ts`, `src/components/reader/sidebar*.types.ts`, `src/hooks/use-badge.ts`, ...). Dropped from the re-export list; the definition stays at its owner. |
| `src/schemas/preferences.ts:31` | `DebugAgentationVisibilityPreference` | types | narrow | `@/schemas/preferences` re-export only. Every consumer imports this name from `@/schemas/preference-values` directly (`src/stores/preferences-store.ts`, `src/components/reader/sidebar*.types.ts`, `src/hooks/use-badge.ts`, ...). Dropped from the re-export list; the definition stays at its owner. |
| `src/schemas/preferences.ts:32` | `FontSizePreference` | types | narrow | `@/schemas/preferences` re-export only. Every consumer imports this name from `@/schemas/preference-values` directly (`src/stores/preferences-store.ts`, `src/components/reader/sidebar*.types.ts`, `src/hooks/use-badge.ts`, ...). Dropped from the re-export list; the definition stays at its owner. |
| `src/schemas/preferences.ts:33` | `FontStylePreference` | types | narrow | `@/schemas/preferences` re-export only. Every consumer imports this name from `@/schemas/preference-values` directly (`src/stores/preferences-store.ts`, `src/components/reader/sidebar*.types.ts`, `src/hooks/use-badge.ts`, ...). Dropped from the re-export list; the definition stays at its owner. |
| `src/schemas/preferences.ts:38` | `LanguagePreference` | types | narrow | `@/schemas/preferences` re-export only. Every consumer imports this name from `@/schemas/preference-values` directly (`src/stores/preferences-store.ts`, `src/components/reader/sidebar*.types.ts`, `src/hooks/use-badge.ts`, ...). Dropped from the re-export list; the definition stays at its owner. |
| `src/schemas/preferences.ts:42` | `PreferenceRecord` | types | narrow | `@/schemas/preferences` re-export only. Every consumer imports this name from `@/schemas/preference-values` directly (`src/stores/preferences-store.ts`, `src/components/reader/sidebar*.types.ts`, `src/hooks/use-badge.ts`, ...). Dropped from the re-export list; the definition stays at its owner. |
| `src/schemas/preferences.ts:44` | `parseLanguagePreference` | exports | narrow | `@/schemas/preferences` re-export only. Every consumer imports this name from `@/schemas/preference-values` directly (`src/stores/preferences-store.ts`, `src/components/reader/sidebar*.types.ts`, `src/hooks/use-badge.ts`, ...). Dropped from the re-export list; the definition stays at its owner. |
| `src/schemas/preferences.ts:45` | `parseThemePreference` | exports | narrow | `@/schemas/preferences` re-export only. Every consumer imports this name from `@/schemas/preference-values` directly (`src/stores/preferences-store.ts`, `src/components/reader/sidebar*.types.ts`, `src/hooks/use-badge.ts`, ...). Dropped from the re-export list; the definition stays at its owner. |
| `src/schemas/preferences.ts:47` | `preferenceKeyMaxLength` | exports | narrow | `@/schemas/preferences` re-export only. Every consumer imports this name from `@/schemas/preference-values` directly (`src/stores/preferences-store.ts`, `src/components/reader/sidebar*.types.ts`, `src/hooks/use-badge.ts`, ...). Dropped from the re-export list; the definition stays at its owner. |
| `src/schemas/preferences.ts:48` | `preferenceValueMaxUtf8Bytes` | exports | narrow | `@/schemas/preferences` re-export only. Every consumer imports this name from `@/schemas/preference-values` directly (`src/stores/preferences-store.ts`, `src/components/reader/sidebar*.types.ts`, `src/hooks/use-badge.ts`, ...). Dropped from the re-export list; the definition stays at its owner. |
| `src/schemas/preferences.ts:49` | `reservedUnknownPreferenceKeyPrefixes` | exports | narrow | `@/schemas/preferences` re-export only. Every consumer imports this name from `@/schemas/preference-values` directly (`src/stores/preferences-store.ts`, `src/components/reader/sidebar*.types.ts`, `src/hooks/use-badge.ts`, ...). Dropped from the re-export list; the definition stays at its owner. |
| `src/schemas/preferences.ts:51` | `SidebarDensityPreference` | types | narrow | `@/schemas/preferences` re-export only. Every consumer imports this name from `@/schemas/preference-values` directly (`src/stores/preferences-store.ts`, `src/components/reader/sidebar*.types.ts`, `src/hooks/use-badge.ts`, ...). Dropped from the re-export list; the definition stays at its owner. |
| `src/schemas/preferences.ts:52` | `SortSubscriptions` | types | narrow | `@/schemas/preferences` re-export only. Every consumer imports this name from `@/schemas/preference-values` directly (`src/stores/preferences-store.ts`, `src/components/reader/sidebar*.types.ts`, `src/hooks/use-badge.ts`, ...). Dropped from the re-export list; the definition stays at its owner. |
| `src/schemas/preferences.ts:53` | `StartupFolderExpansionPreference` | types | narrow | `@/schemas/preferences` re-export only. Every consumer imports this name from `@/schemas/preference-values` directly (`src/stores/preferences-store.ts`, `src/components/reader/sidebar*.types.ts`, `src/hooks/use-badge.ts`, ...). Dropped from the re-export list; the definition stays at its owner. |
| `src/schemas/preferences.ts:54` | `Theme` | types | narrow | `@/schemas/preferences` re-export only. Every consumer imports this name from `@/schemas/preference-values` directly (`src/stores/preferences-store.ts`, `src/components/reader/sidebar*.types.ts`, `src/hooks/use-badge.ts`, ...). Dropped from the re-export list; the definition stays at its owner. |
| `src/schemas/preferences.ts:55` | `UnreadBadgePreference` | types | narrow | `@/schemas/preferences` re-export only. Every consumer imports this name from `@/schemas/preference-values` directly (`src/stores/preferences-store.ts`, `src/components/reader/sidebar*.types.ts`, `src/hooks/use-badge.ts`, ...). Dropped from the re-export list; the definition stays at its owner. |
| `src/schemas/preferences.ts:61` | `themeSchema` | exports | narrow | Only consumer is `preferenceSchemas.theme` in the same file. |
| `src/schemas/preferences.ts:105` | `shortcutPreferenceValueSchema` | exports | narrow | Only consumer is `getPreferenceValueSchema` in the same file. |
| `src/schemas/preferences.ts:179` | `isReservedUnknownPreferenceKey` | exports | remove | No caller anywhere, and a second, divergent implementation of the same name already lives at `src/schemas/preference-values.ts:322`, which is what `src/api/schemas/preferences.ts` actually imports. Keeping the dead copy invites picking the wrong one. |
| `src/schemas/preferences.ts:187` | `parsePreferenceValue` | exports | remove | No caller anywhere and no in-file use. `resolvePreferenceValue` / `normalizePreferenceValue` in `preference-values.ts` own this job. |
| `src/schemas/storage.ts:81` | `CommandHistoryStorage` | types | remove | Unused `InferOutput` alias with no in-file reference; the schema itself stays exported. |
| `src/schemas/storage.ts:206` | `StorageCleanupPolicyConnections` | types | remove | Unused `InferOutput` alias with no in-file reference; the schema itself stays exported. |
| `src/schemas/subscriptions-workspace.ts:28` | `SubscriptionsWorkspaceListScrollStateSchema` | exports | narrow | Used in-file by the exported `SubscriptionsWorkspaceListScrollState` type and by `SubscriptionsWorkspaceReturnStateSchema`. |
| `src/stores/ui-store.ts:20` | `ArticleEngagement` | types | narrow | `export type { ... } from "@/stores/ui-store.types"` entry nobody reaches; `src/components/reader/hooks/article/use-article-auto-mark.ts` imports it from `@/stores/ui-store.types` directly. |
| `tests/helpers/api-fixtures.ts:6` | `listSampleArticlesByAccountId` | exports | narrow | Re-export from `./reader-fixtures` nobody reaches; the tests that use these names import them from `@tests/helpers/reader-fixtures` directly. The other names in the same block are still consumed through `api-fixtures`, so the barrel stays. |
| `tests/helpers/api-fixtures.ts:7` | `listSampleArticlesByFeedId` | exports | narrow | Re-export from `./reader-fixtures` nobody reaches; the tests that use these names import them from `@tests/helpers/reader-fixtures` directly. The other names in the same block are still consumed through `api-fixtures`, so the barrel stays. |
| `tests/helpers/api-fixtures.ts:8` | `listSampleArticlesByTagId` | exports | narrow | Re-export from `./reader-fixtures` nobody reaches; the tests that use these names import them from `@tests/helpers/reader-fixtures` directly. The other names in the same block are still consumed through `api-fixtures`, so the barrel stays. |
| `tests/helpers/api-fixtures.ts:9` | `listSampleFeedsByAccountId` | exports | narrow | Re-export from `./reader-fixtures` nobody reaches; the tests that use these names import them from `@tests/helpers/reader-fixtures` directly. The other names in the same block are still consumed through `api-fixtures`, so the barrel stays. |
| `tests/helpers/api-fixtures.ts:12` | `requireSampleReadArticle` | exports | narrow | Re-export from `./reader-fixtures` nobody reaches; the tests that use these names import them from `@tests/helpers/reader-fixtures` directly. The other names in the same block are still consumed through `api-fixtures`, so the barrel stays. |
| `tests/helpers/api-fixtures.ts:13` | `requireSampleStarredArticle` | exports | narrow | Re-export from `./reader-fixtures` nobody reaches; the tests that use these names import them from `@tests/helpers/reader-fixtures` directly. The other names in the same block are still consumed through `api-fixtures`, so the barrel stays. |
| `tests/helpers/api-fixtures.ts:14` | `requireSampleUnreadArticle` | exports | narrow | Re-export from `./reader-fixtures` nobody reaches; the tests that use these names import them from `@tests/helpers/reader-fixtures` directly. The other names in the same block are still consumed through `api-fixtures`, so the barrel stays. |
| `tests/helpers/console-spies.ts:13` | `ConsoleWarnSpy` | types | remove | No reference anywhere, including in-file. `suppressConsoleWarn` and `ConsoleErrorSpy` stay. |
| `tests/helpers/fixture-types.ts:3` | `CommandSuccess` | types | narrow | Used in-file by `CommandListItem`. `src/__tests__/api/tauri-commands.node.test.ts` and `tests/helpers/fixtures.test.ts` each declare their own local copy of the conditional type, so the name co-occurrence there is not a consumer. |
| `tests/helpers/observer-mocks.ts:162` | `hasInstalledTestObserverMocks` | exports | remove | No caller. Removing it left `isTestResizeObserver` / `isTestMutationObserver`, the `ObserverMockConstructor` type, the two `Symbol.for` markers, and their static class fields with no reader either; the whole marker mechanism existed only for this predicate, so it was removed as one unit. |
| `tests/helpers/reader-fixtures.ts:262` | `collectFeedIdsByAccount` | exports | narrow | Used in-file by `listArticlesByAccountId`. `src/dev/mocks.ts` imports a same-named helper from `@/dev/mock-state`, not from this module. |
| `tests/helpers/reader-fixtures.ts:274` | `listArticlesByFeedId` | exports | narrow | Used in-file by `listSampleArticlesByFeedId`. |
| `tests/helpers/reader-fixtures.ts:333` | `listArticlesByAccountId` | exports | narrow | Used in-file by `listSampleArticlesByAccountId`. |
| `tests/helpers/storybook-story-export-registry.ts:27` | `StorybookStoryExportRegistryEntry` | types | narrow | Used in-file when building the registry array. |
| `tests/helpers/storybook-story-export-registry.ts:41` | `STORYBOOK_HELPER_EXPORT_ALLOWLIST` | exports | narrow | Used in-file by `STORYBOOK_HELPER_EXPORT_ALLOWLIST_IDS`, which is the exported lookup. |
| `tests/helpers/tauri-command-contract.ts:14` | `runCommandCases` | exports | narrow | Called in-file by `runValidationCommandCases`, which is the helper tests actually import. |

## Residual Follow-Up

`get_platform_permission_denied_recovery` is wired end to end — Rust command, DTO, capability
allowlist, browser dev mock, TypeScript wrapper — with no UI caller. The wrapper is kept as an
accepted risk because the mock-parity test pins it, but the open decision remains: either wire a
caller or retire the command across all five surfaces. Retiring it is a boundary change and was
deliberately out of scope here.

Three duplications surfaced during triage and were left alone as out-of-scope:

- `isReservedUnknownPreferenceKey` existed twice with different behaviour; the dead copy was removed,
  so only `src/schemas/preference-values.ts` defines it now.
- `type CommandSuccess<TCommand>` is declared identically in `tests/helpers/fixture-types.ts`,
  `src/__tests__/api/tauri-commands.node.test.ts`, and `tests/helpers/fixtures.test.ts`.
- `type TauriCapabilityFile` is declared locally in `tests/release-repo-contract.node.test.ts`,
  `scripts/check-release-build-contamination.ts`, and `scripts/release/validate-release-config.ts`
  while `src/schemas/app-config.ts` exported an unused alias of the same shape (now removed).
