import type { TypeSurfaceAllowlistEntry } from "./type-surface";

const typeSurfaceIntent = "Remaining shared type surface; keep only while referenced across the feature boundary.";
const typeSurfaceFollowUpNote = "P2 type-surface contract を remaining `.types.ts` allowlist の ratchet gate にする";

export function remainingTypeSurface(
  path: string,
  allowedRestrictedExports: readonly string[] = [],
): TypeSurfaceAllowlistEntry {
  return {
    path,
    intent: typeSurfaceIntent,
    followUpNote: typeSurfaceFollowUpNote,
    allowedRestrictedExports,
  };
}

export const remainingTypeSurfaceAllowlist = [
  remainingTypeSurface("src/components/reader/add-feed-dialog.types.ts", [
    "AddFeedDialogControllerParams",
    "AddFeedDialogFolderSelectionParams",
    "AddFeedDialogProps",
    "ResolveAddFeedDialogDerivedParams",
  ]),
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
  remainingTypeSurface("src/components/reader/feed-edit-dialog.types.ts", [
    "FeedEditDialogProps",
    "FeedEditDialogControllerParams",
    "SubmitFeedEditsParams",
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
  remainingTypeSurface("src/components/settings/settings-page.types.ts", ["SettingsPageViewProps"]),
  remainingTypeSurface("src/lib/subscriptions/subscriptions-index.types.ts"),
  remainingTypeSurface("src/lib/ui/action.types.ts"),
  remainingTypeSurface("src/lib/ui/display-state.types.ts"),
  remainingTypeSurface("src/lib/ui/toast.types.ts"),
  remainingTypeSurface("src/stores/preferences-store.types.ts"),
  remainingTypeSurface("src/stores/ui-store.types.ts"),
] as const;
