---
type: record
title: Similarity Pair Classification
description: Dated triage record for similarity-ts function and type pairs at threshold 0.9; durable heuristics live in quality-policy.md.
resource: urn:ultra-rss-reader:docs:similarity-pair-classification
tags: [category/quality, audience/agent, audience/developer, status/historical]
timestamp: 2026-09-22
audience: agent, developer
owner: project-maintainers
---

# Similarity Pair Classification

Triage record for `similarity-ts --threshold 0.9 src/` at commit `5a645904fbb896b111a3b1f84f261435cbdad7f0` (includes #327). The durable scan rules, hub-noise heuristics, and allowlist limits live in [../.claude/rules/quality-policy.md](../.claude/rules/quality-policy.md). This file is the pair-level inventory those counts must explain.

## Scan contract

| Metric | Count at scanSha | Display baseline in scripts/similarity-report.ts |
| --- | ---: | ---: |
| Function pairs | 38 | 38 |
| Named type pairs | 17 | 17 |
| Type literal pairs | 0 | 0 |
| CSS rules / exact / similar / BEM | 98 / 0 / 8 / 10 | 98 / 0 / 8 / 10 |

Re-pin rule: compare **pair sets**, not totals alone. Rows are not deleted when a pair disappears; mark the row `removed-at-<sha>` in a follow-up edit instead.

### Allowlist entries absent from this scan

Three function allowlist ids did not match any pair at scanSha (scan still lists them as `absent` in the report summary): `article-auto-mark-vs-browser-webview-sync`, `article-auto-mark-vs-browser-overlay-focus-return`, `article-auto-mark-vs-browser-overlay-close`. Keep the ids until a scan omits them long enough to justify removal.

## Function pairs (38)

| Similarity % | Symbol A | Symbol B | Classification | Rationale |
| --- | --- | --- | --- | --- |
| 91.37 | useFeedTreePointerDragEvents | buildOutput | pending | No extraction decision at scanSha |
| 92.70 | useBrowserWebviewBoundsSync | useUpdater | false-positive | allowlist browser-bounds-lifecycle-vs-updater-lifecycle |
| 90.16 | useArticleListEffects | useSidebarNavButtonTrailing | pending | No extraction decision at scanSha |
| 94.29 | useBrowserWebviewBoundsSync | useSidebarAccountSelection | false-positive | allowlist browser-bounds-lifecycle-vs-sidebar-account-selection |
| 90.00 | useArticleListEffects | buildAddAccountPayload | pending | No extraction decision at scanSha |
| 90.58 | useScrollOverflowState | buildSubscriptionReviewCandidates | false-positive | allowlist scroll-overflow-state-vs-subscription-review-candidates |
| 91.57 | useMouseNavigation | useUpdater | pending | No extraction decision at scanSha |
| 90.75 | handleDelete | useUpdater | pending | No extraction decision at scanSha |
| 94.29 | useBrowserDebugGeometryEvents | useBrowserWebviewBoundsSync | hub-noise | useBrowserWebviewBoundsSync hub; triage by symbol frequency |
| 92.70 | useBrowserWebviewBoundsSync | useMouseNavigation | hub-noise | useBrowserWebviewBoundsSync hub; triage by symbol frequency |
| 92.70 | useBrowserWebviewBoundsSync | useBrowserWebviewLoadTimeout | hub-noise | useBrowserWebviewBoundsSync hub; triage by symbol frequency |
| 90.19 | useAccountSwitcherViewModel | useScrollOverflowState | pending | No extraction decision at scanSha |
| 92.22 | useBrowserWebviewBoundsSync | useSubscriptionsIndexEscape | hub-noise | useBrowserWebviewBoundsSync hub; triage by symbol frequency |
| 92.86 | useBrowserWebviewBoundsSync | handleDelete | hub-noise | useBrowserWebviewBoundsSync hub; triage by symbol frequency |
| 92.70 | useBrowserOverlayShortcuts | useBrowserWebviewBoundsSync | hub-noise | useBrowserWebviewBoundsSync hub; triage by symbol frequency |
| 91.22 | useBrowserDebugGeometryEvents | useSidebarAccountSelection | pending | No extraction decision at scanSha |
| 92.65 | useBrowserWebviewLoadTimeout | useSidebarAccountSelection | pending | No extraction decision at scanSha |
| 90.63 | useBrowserWebviewBoundsSync | patchCachedAccount | false-positive | allowlist account-cache-patcher-vs-browser-bounds-lifecycle |
| 92.65 | useBrowserOverlayShortcuts | useSidebarAccountSelection | pending | No extraction decision at scanSha |
| 90.00 | useSidebarAccountSelection | patchCachedAccount | pending | No extraction decision at scanSha |
| 93.53 | useAccountDetailSyncStatusRows | buildSubscriptionListRows | pending | No extraction decision at scanSha |
| 91.00 | useBrowserDebugGeometryEvents | useBrowserWebviewLoadTimeout | pending | No extraction decision at scanSha |
| 90.98 | useBrowserWebviewLoadTimeout | useMouseNavigation | pending | No extraction decision at scanSha |
| 91.57 | useBrowserWebviewStateChanged | useAccountDetailSyncStatusRows | pending | No extraction decision at scanSha |
| 91.32 | useBrowserWebviewStateChanged | buildSubscriptionListRows | pending | No extraction decision at scanSha |
| 90.98 | renderBrowserWebviewSync | useAccountDetailSyncStatusRows | pending | No extraction decision at scanSha |
| 90.75 | handleDelete | useMouseNavigation | pending | No extraction decision at scanSha |
| 91.51 | useBrowserWebviewLoadTimeout | handleDelete | pending | No extraction decision at scanSha |
| 91.25 | useSubscriptionsReviewClock | useResolvedDevIntent | pending | No extraction decision at scanSha |
| 91.00 | useBrowserDebugGeometryEvents | useBrowserOverlayShortcuts | pending | No extraction decision at scanSha |
| 90.98 | useBrowserOverlayShortcuts | useMouseNavigation | pending | No extraction decision at scanSha |
| 92.94 | typescriptFilesUnder | useAccountDetailSyncStatusRows | pending | No extraction decision at scanSha |
| 92.15 | resolveAccountDetailSyncWarningDetailLine | useAccountDetailSyncStatusRows | pending | No extraction decision at scanSha |
| 90.45 | patchCachedAccount | useSubscriptionsIndexEscape | pending | No extraction decision at scanSha |
| 90.19 | useBrowserOverlayShortcuts | handleDelete | pending | No extraction decision at scanSha |
| 93.68 | useArticles | useAccountArticles | pending | Track A-4 factory; separate task |
| 90.53 | typescriptFilesUnder | useBrowserWebviewStateChanged | pending | No extraction decision at scanSha |
| 90.04 | useBrowserWebviewStateChanged | resolveAccountDetailSyncWarningDetailLine | pending | No extraction decision at scanSha |

## Type pairs (17)

Type pairs are recorded here because `similarityFalsePositiveBaseline` cannot match them (parser returns only the function half). See quality-policy.md.

| Similarity % | Symbol A | Symbol B | Classification | Rationale |
| --- | --- | --- | --- | --- |
| 100.00 | ResolvedDevIntentState | ResolvedDevIntentState | false-positive | vite production alias mirror |
| 96.63 | AddAccountPayload | AddAccountFormState | false-positive | optional vs required serverUrl contract |
| 95.38 | SidebarSourcesParams | UseArticleListSearchParams | false-positive | one-consumer hook param types |
| 95.00 | LeavingFeedEntry | LogicalFeedInfo | false-positive | intentional frozen vs live view models |
| 94.16 | CreateMutationInvalidationDiagnostics | QueryInvalidationIntentMatrixEntry | pending | No type-pair allowlist entry; record here |
| 93.82 | DatabaseRestoreAccount | TestArgs | pending | No type-pair allowlist entry; record here |
| 93.60 | AccountSyncStatusRow | OptionWithLabel | pending | No type-pair allowlist entry; record here |
| 93.48 | SettingsPageControlIdentity | DatabaseRestoreAccount | pending | No type-pair allowlist entry; record here |
| 93.48 | SettingsPageControlIdentity | Article | pending | No type-pair allowlist entry; record here |
| 93.45 | DatabaseRestoreAccount | Article | pending | No type-pair allowlist entry; record here |
| 93.39 | AccountSyncStatusRow | BrowserDebugGeometryRow | pending | No type-pair allowlist entry; record here |
| 93.19 | SettingsPageControlIdentity | TestArgs | pending | No type-pair allowlist entry; record here |
| 93.11 | HookProps | InvalidateFeedMutationQueriesOptions | pending | No type-pair allowlist entry; record here |
| 93.00 | TestArgs | Article | pending | No type-pair allowlist entry; record here |
| 92.80 | QueryInvalidationSpy | InvocationOrderMock | pending | No type-pair allowlist entry; record here |
| 92.70 | OptionWithLabel | BrowserDebugGeometryRow | pending | No type-pair allowlist entry; record here |
| 90.88 | ArticleListPresentationSearch | UseArticleListSearchResult | pending | No type-pair allowlist entry; record here |
