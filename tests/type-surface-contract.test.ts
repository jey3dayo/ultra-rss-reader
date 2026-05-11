import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createTypeSurfaceHelper } from "@tests/helpers/type-surface";
import { describe, expect, it } from "vitest";

function remainingTypeSurface(path: string, allowedRestrictedExports: readonly string[] = []) {
  return {
    path,
    intent: "Remaining shared type surface tracked by the ratchet contract.",
    followUpTodo: "TODO.md P2 type-surface contract",
    allowedRestrictedExports,
  };
}

const REPO_TYPE_SURFACE_ALLOWLIST = [
  remainingTypeSurface("src/components/reader/add-feed-dialog.types.ts", [
    "AddFeedDialogControllerParams",
    "AddFeedDialogFolderSelectionParams",
    "AddFeedDialogProps",
    "ResolveAddFeedDialogDerivedParams",
  ]),
  remainingTypeSurface("src/components/reader/article-actions.types.ts", ["ArticleToastActionParams"]),
  remainingTypeSurface("src/components/reader/article-list.types.ts", ["HandleArticleListKeyboardActionParams"]),
  remainingTypeSurface("src/components/reader/article-tag-picker.types.ts", ["ArticleTagPickerViewProps"]),
  remainingTypeSurface("src/components/reader/browser-view.types.ts", [
    "ResolveBrowserViewPresentationParams",
    "ResolveBrowserViewSurfacePresentationParams",
  ]),
  remainingTypeSurface("src/components/reader/command-palette.types.ts", [
    "CommandPaletteControllerResult",
    "CommandPaletteResultsProps",
    "CommandPaletteViewPropsResult",
  ]),
  remainingTypeSurface("src/components/reader/feed-dialog-form.types.ts", [
    "FeedDialogControllerFolderSelectProps",
    "FeedDialogFolderSelectionParams",
    "FeedDialogReadonlyFieldProps",
  ]),
  remainingTypeSurface("src/components/reader/feed-tree.types.ts", ["FeedTreeRowProps", "FeedTreeViewProps"]),
  remainingTypeSurface("src/components/reader/hooks/article-list/article-list-controller.types.ts", [
    "UseArticleListDataParams",
    "UseArticleListDataResult",
    "UseArticleListHeaderActionsParams",
    "UseArticleListHeaderActionsResult",
    "UseArticleListHeaderControllerParams",
    "UseArticleListHeaderControllerResult",
    "UseArticleListHeaderControlsParams",
    "UseArticleListHeaderControlsResult",
    "UseArticleListInteractionsParams",
    "UseArticleListInteractionsResult",
    "UseArticleListPresentationParams",
    "UseArticleListSearchParams",
    "UseArticleListSearchResult",
    "UseArticleListSourcesParams",
    "UseArticleListSourcesResult",
    "UseArticleListViewPropsParams",
    "UseArticleListViewPropsResult",
    "UseArticleListViewStateParams",
    "UseArticleListViewStateResult",
  ]),
  remainingTypeSurface("src/components/reader/hooks/feed-tree/feed-tree-drag.types.ts", [
    "UseFeedTreeDragParams",
    "UseFeedTreeDragResult",
    "UseFeedTreePointerDragEventsParams",
  ]),
  remainingTypeSurface("src/components/reader/rename-feed-dialog.types.ts", [
    "RenameDialogProps",
    "RenameFeedDialogControllerParams",
    "SubmitFeedEditsParams",
  ]),
  remainingTypeSurface("src/components/reader/sidebar-feed-section.types.ts", [
    "SidebarFeedDragStateParams",
    "SidebarFeedDragStateResult",
    "SidebarFeedNavigationParams",
    "SidebarFeedSectionParams",
    "SidebarFeedSectionResult",
    "SidebarFeedTreeProps",
    "SidebarFeedTreePropsParams",
    "SidebarStartupFolderExpansionParams",
    "SidebarVisibilityFallbackParams",
  ]),
  remainingTypeSurface("src/components/reader/sidebar-feed-tree.types.ts", [
    "UseSidebarFeedTreeParams",
    "UseSidebarFeedTreeResult",
  ]),
  remainingTypeSurface("src/components/reader/sidebar-runtime.types.ts", [
    "SidebarAccountSelectionParams",
    "SidebarAccountSwitcherResult",
    "SidebarRuntimeResult",
    "SidebarUiStateResult",
  ]),
  remainingTypeSurface("src/components/reader/sidebar-sources.types.ts", [
    "SidebarAccountStatusLabelsParams",
    "SidebarSourcesParams",
    "SidebarSourcesResult",
  ]),
  remainingTypeSurface("src/components/reader/sidebar.types.ts", [
    "SidebarAccountSectionPropsParams",
    "SidebarContentSectionsPropsParams",
    "SidebarContextMenuRenderersResult",
    "SidebarControllerResult",
    "SidebarControllerSectionsParams",
    "SidebarHeaderPropsParams",
    "SidebarSectionPropsParams",
    "SidebarSectionPropsResult",
    "SidebarSmartViewsParams",
    "SidebarSmartViewsPropsParams",
    "SidebarSmartViewsResult",
    "SidebarViewPropsParams",
    "SidebarViewPropsResult",
  ]),
  remainingTypeSurface("src/components/settings/account-detail/sync.types.ts", ["UpdateAccountSyncParams"]),
  remainingTypeSurface("src/components/settings/accounts-nav.types.ts", ["AccountsNavViewProps"]),
  remainingTypeSurface("src/components/settings/add-account/form-view.types.ts"),
  remainingTypeSurface("src/components/settings/add-account/services.types.ts"),
  remainingTypeSurface("src/components/settings/settings-modal.types.ts", ["SettingsModalViewProps"]),
  remainingTypeSurface("src/components/settings/settings-nav.types.ts", ["SettingsNavViewProps"]),
  remainingTypeSurface("src/components/settings/settings-page.types.ts", ["SettingsPageViewProps"]),
  remainingTypeSurface("src/components/settings/settings-preference.types.ts", ["SettingsPreferenceViewPropsParams"]),
  remainingTypeSurface("src/lib/subscriptions/subscription-summary-filter.types.ts"),
  remainingTypeSurface("src/lib/subscriptions/subscriptions-index.types.ts"),
  remainingTypeSurface("src/lib/subscriptions/subscriptions-workspace.types.ts"),
] as const;

function writeRepoFile(repoRoot: string, path: string, source: string) {
  const filePath = join(repoRoot, path);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, source);
}

describe("type surface contract helper", () => {
  it("reports exported interfaces that are no longer referenced outside the surface file", () => {
    const repoRoot = mkdtempSync(join(tmpdir(), "type-surface-"));
    writeRepoFile(repoRoot, "src/surface.types.ts", "export interface PublicProps { id: string }\n");
    writeRepoFile(repoRoot, "src/consumer.ts", "const unrelated = true;\n");

    const helper = createTypeSurfaceHelper({
      expect,
      repoRoot,
      searchDirectories: ["src"],
    });

    expect(
      helper.collectPublicContractDiagnostics({
        label: "test public contract",
        typeFileList: ["src/surface.types.ts"],
      }),
    ).toEqual([
      "src/surface.types.ts:PublicProps should stay in test public contract or move out of the public type surface",
    ]);
  });

  it("reports re-exported types that are no longer referenced outside the surface file", () => {
    const repoRoot = mkdtempSync(join(tmpdir(), "type-surface-"));
    writeRepoFile(repoRoot, "src/internal.ts", "export type PublicResult = { ok: boolean };\n");
    writeRepoFile(repoRoot, "src/surface.types.ts", 'export type { PublicResult } from "./internal";\n');
    writeRepoFile(repoRoot, "src/consumer.ts", "const unrelated = true;\n");

    const helper = createTypeSurfaceHelper({
      expect,
      repoRoot,
      searchDirectories: ["src"],
    });

    expect(
      helper.collectPublicContractDiagnostics({
        label: "test public contract",
        typeFileList: ["src/surface.types.ts"],
      }),
    ).toEqual([
      "src/surface.types.ts:PublicResult should stay in test public contract or move out of the public type surface",
    ]);
  });

  it("reports remaining type surface files that drift outside the allowlist", () => {
    const repoRoot = mkdtempSync(join(tmpdir(), "type-surface-"));
    writeRepoFile(repoRoot, "src/known.types.ts", "export type KnownContract = { id: string };\n");
    writeRepoFile(repoRoot, "src/new.types.ts", "export type NewContract = { id: string };\n");

    const helper = createTypeSurfaceHelper({
      expect,
      repoRoot,
      searchDirectories: ["src"],
    });

    expect(() =>
      helper.assertRemainingTypeSurfaceAllowlist({
        label: "test remaining allowlist",
        typeFileList: [remainingTypeSurface("src/known.types.ts")],
      }),
    ).toThrowError();
  });
});

describe("reader/settings/subscriptions type surface contract", () => {
  it("keeps the remaining .types.ts files on an explicit allowlist", () => {
    const helper = createTypeSurfaceHelper({
      expect,
      repoRoot: process.cwd(),
      searchDirectories: ["src/components/reader", "src/components/settings", "src/lib/subscriptions"],
    });

    helper.assertRemainingTypeSurfaceAllowlist({
      label: "reader/settings/subscriptions remaining .types.ts allowlist",
      typeFileList: REPO_TYPE_SURFACE_ALLOWLIST,
    });
  });
});
