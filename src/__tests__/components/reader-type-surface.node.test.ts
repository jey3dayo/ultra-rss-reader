import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createTypeSurfaceHelper, type TypeSurfaceContract } from "@tests/helpers/type-surface";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();

const readerTypeSurfaceFiles = [
  "src/components/reader/add-feed-dialog.types.ts",
  "src/components/reader/article-actions.types.ts",
  "src/components/reader/article-list.types.ts",
  "src/components/reader/browser-view.types.ts",
  "src/components/reader/command-palette.types.ts",
  "src/components/reader/feed-tree.types.ts",
  "src/components/reader/rename-feed-dialog.types.ts",
  "src/components/reader/sidebar-feed-section.types.ts",
  "src/components/reader/sidebar-runtime.types.ts",
  "src/components/reader/sidebar-sources.types.ts",
  "src/components/reader/sidebar.types.ts",
] as const;

const settingsTypeSurfaceFiles = [
  "src/components/settings/settings-modal.types.ts",
  "src/components/settings/settings-nav.types.ts",
  "src/components/settings/settings-page.types.ts",
] as const;

const localOnlyTypeSurfaceFiles = [
  "src/components/reader/article-actions.types.ts",
  "src/components/reader/sidebar-runtime.types.ts",
  "src/components/reader/sidebar-sources.types.ts",
  "src/components/settings/add-account/form-view.types.ts",
] as const;

const typeSurfaceIntent = "Remaining shared type surface; keep only while referenced across the feature boundary.";
const typeSurfaceFollowUpTodo = "P2 type-surface contract を remaining `.types.ts` allowlist の ratchet gate にする";
const allowTypeSurface = (path: string, allowedRestrictedExports: readonly string[] = []) => ({
  path,
  intent: typeSurfaceIntent,
  followUpTodo: typeSurfaceFollowUpTodo,
  allowedRestrictedExports,
});

const remainingTypeSurfaceFiles = [
  allowTypeSurface("src/components/reader/add-feed-dialog.types.ts", [
    "AddFeedDialogControllerParams",
    "AddFeedDialogFolderSelectionParams",
    "AddFeedDialogProps",
    "ResolveAddFeedDialogDerivedParams",
  ]),
  allowTypeSurface("src/components/reader/article-actions.types.ts", ["ArticleToastActionParams"]),
  allowTypeSurface("src/components/reader/article-list.types.ts", ["HandleArticleListKeyboardActionParams"]),
  allowTypeSurface("src/components/reader/article-tag-picker.types.ts", ["ArticleTagPickerViewProps"]),
  allowTypeSurface("src/components/reader/browser-view.types.ts", [
    "ResolveBrowserViewPresentationParams",
    "ResolveBrowserViewSurfacePresentationParams",
  ]),
  allowTypeSurface("src/components/reader/command-palette.types.ts", [
    "CommandPaletteControllerResult",
    "CommandPaletteResultsProps",
    "CommandPaletteViewPropsResult",
  ]),
  allowTypeSurface("src/components/reader/feed-dialog-form.types.ts", [
    "FeedDialogControllerFolderSelectProps",
    "FeedDialogFolderSelectionParams",
    "FeedDialogReadonlyFieldProps",
  ]),
  allowTypeSurface("src/components/reader/feed-tree.types.ts", ["FeedTreeRowProps", "FeedTreeViewProps"]),
  allowTypeSurface("src/components/reader/hooks/article-list/article-list-controller.types.ts", [
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
  allowTypeSurface("src/components/reader/hooks/feed-tree/feed-tree-drag.types.ts", [
    "UseFeedTreeDragParams",
    "UseFeedTreeDragResult",
    "UseFeedTreePointerDragEventsParams",
  ]),
  allowTypeSurface("src/components/reader/rename-feed-dialog.types.ts", [
    "RenameDialogProps",
    "RenameFeedDialogControllerParams",
    "SubmitFeedEditsParams",
  ]),
  allowTypeSurface("src/components/reader/sidebar-feed-section.types.ts", [
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
  allowTypeSurface("src/components/reader/sidebar-feed-tree.types.ts", [
    "UseSidebarFeedTreeParams",
    "UseSidebarFeedTreeResult",
  ]),
  allowTypeSurface("src/components/reader/sidebar-runtime.types.ts", [
    "SidebarAccountSelectionParams",
    "SidebarAccountSwitcherResult",
    "SidebarRuntimeResult",
    "SidebarUiStateResult",
  ]),
  allowTypeSurface("src/components/reader/sidebar-sources.types.ts", [
    "SidebarAccountStatusLabelsParams",
    "SidebarSourcesParams",
    "SidebarSourcesResult",
  ]),
  allowTypeSurface("src/components/reader/sidebar.types.ts", [
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
  allowTypeSurface("src/components/settings/account-detail/sync.types.ts", ["UpdateAccountSyncParams"]),
  allowTypeSurface("src/components/settings/accounts-nav.types.ts", ["AccountsNavViewProps"]),
  allowTypeSurface("src/components/settings/add-account/form-view.types.ts"),
  allowTypeSurface("src/components/settings/add-account/services.types.ts"),
  allowTypeSurface("src/components/settings/settings-modal.types.ts", ["SettingsModalViewProps"]),
  allowTypeSurface("src/components/settings/settings-nav.types.ts", ["SettingsNavViewProps"]),
  allowTypeSurface("src/components/settings/settings-page.types.ts", ["SettingsPageViewProps"]),
  allowTypeSurface("src/components/settings/settings-preference.types.ts", ["SettingsPreferenceViewPropsParams"]),
  allowTypeSurface("src/lib/subscriptions/subscription-summary-filter.types.ts"),
  allowTypeSurface("src/lib/subscriptions/subscriptions-index.types.ts"),
  allowTypeSurface("src/lib/subscriptions/subscriptions-workspace.types.ts"),
] as const;

const cleanupContractTestFiles = {
  semanticTokenAndRoleContracts: [
    "src/__tests__/components/article-filter-toggle-button.test.ts",
    "src/__tests__/components/article-list-context-strip.test.tsx",
    "src/__tests__/components/article-list-footer.test.tsx",
    "src/__tests__/components/article-list-item.test.tsx",
    "src/__tests__/components/surface-card.test.tsx",
  ],
  readerPureHelperContracts: [
    "src/__tests__/components/article-list-item.test.tsx",
    "src/__tests__/components/feed-mark-all-read.node.test.ts",
    "src/__tests__/components/use-article-list-navigation.node.test.tsx",
  ],
  publicWrapperSurfaceContracts: ["src/__tests__/components/ui-wrapper-public-api.node.test.ts"],
} as const;

const typeSurfaceSearchDirectories = [
  "src/components/reader",
  "src/components/settings",
  "src/__tests__/components",
  "src/__tests__/hooks",
] as const;

const remainingTypeSurfaceSearchDirectories = [
  "src/components/reader",
  "src/components/settings",
  "src/lib/subscriptions",
] as const;

function readRepoFile(path: string) {
  return readFileSync(join(repoRoot, path), "utf8");
}

const typeSurfaceHelper = createTypeSurfaceHelper({
  expect,
  repoRoot,
  searchDirectories: typeSurfaceSearchDirectories,
});

const remainingTypeSurfaceHelper = createTypeSurfaceHelper({
  expect,
  repoRoot,
  searchDirectories: remainingTypeSurfaceSearchDirectories,
});

const publicContractAllowlist = {
  reader: {
    label: "reader public contract allowlist",
    typeFileList: readerTypeSurfaceFiles,
  },
  settings: {
    label: "settings public contract allowlist",
    typeFileList: settingsTypeSurfaceFiles,
  },
} as const satisfies Record<string, TypeSurfaceContract>;

const viewLocalPropsBlacklist = {
  label: "view-local props blacklist",
  typeFileList: localOnlyTypeSurfaceFiles,
} as const satisfies TypeSurfaceContract;

describe("reader type surface", () => {
  it("tracks the reader feature-local type split candidates", () => {
    typeSurfaceHelper.assertTypeFileList(publicContractAllowlist.reader);
  });

  it("keeps exported reader type contracts externally referenced", () => {
    expect(typeSurfaceHelper.collectPublicContractDiagnostics(publicContractAllowlist.reader)).toEqual([]);
  });

  it("tracks settings feature-local type split candidates", () => {
    typeSurfaceHelper.assertTypeFileList(publicContractAllowlist.settings);
  });

  it("keeps exported settings type contracts externally referenced", () => {
    expect(typeSurfaceHelper.collectPublicContractDiagnostics(publicContractAllowlist.settings)).toEqual([]);
  });

  it("tracks local-only exported Props/Params/Result cleanup candidates", () => {
    typeSurfaceHelper.assertTypeFileList(viewLocalPropsBlacklist);
  });

  it("keeps local-only exported type contracts externally referenced", () => {
    expect(typeSurfaceHelper.collectPublicContractDiagnostics(viewLocalPropsBlacklist)).toEqual([]);
  });

  it("keeps remaining .types.ts files on an explicit ratchet allowlist", () => {
    remainingTypeSurfaceHelper.assertRemainingTypeSurfaceAllowlist({
      label: "remaining type surface allowlist",
      typeFileList: remainingTypeSurfaceFiles,
    });
  });

  it("tracks small cleanup contracts without adding broad visual snapshots", () => {
    const contractTestFiles = Object.values(cleanupContractTestFiles).flat();

    expect(contractTestFiles.filter((path) => !existsSync(join(repoRoot, path)))).toEqual([]);

    for (const contractTestFile of contractTestFiles) {
      const source = readRepoFile(contractTestFile);

      expect(source, `${contractTestFile} should avoid snapshot-based visual coverage`).not.toContain(
        "toMatchSnapshot",
      );
      expect(source, `${contractTestFile} should stay focused on contract assertions`).toMatch(
        /toHaveAttribute|toHaveClass|expectTypeOf|toEqual|toContain|toBe|toHaveBeenCalledWith/,
      );
    }
  });
});
