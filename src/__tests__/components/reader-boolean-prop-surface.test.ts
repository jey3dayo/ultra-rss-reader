import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();

const readerBooleanPropCandidateContracts = [
  {
    file: "src/components/reader/article-toolbar-view.tsx",
    groupedProps: ["actions: readonly ArticleToolbarMoreMenuAction[];", "moreActionsLabel: string;"],
    variantProps: ['kind: "open-in-external-browser";', 'kind: "copy-link";'],
    forbiddenProps: ["showExternalBrowser"],
    forbiddenPropsScope: ["function ArticleToolbarMoreMenu", "function ArticleToolbarMobilePrimaryButton"],
  },
  {
    file: "src/components/reader/sidebar-header-view.tsx",
    groupedProps: [
      "displayState: SidebarHeaderDisplayState;",
      "syncState: SidebarHeaderSyncState;",
      "actionAvailability?: SidebarHeaderActionAvailability;",
    ],
    variantProps: ['layout: "desktop" | "mobile";', 'titlebar: "standard" | "desktop-overlay";'],
    forbiddenProps: ["isMobile", "useDesktopOverlay", "isSyncing", "isSyncDisabled", "isSyncCoolingDown"],
  },
  {
    file: "src/components/reader/command-palette-resource-groups.tsx",
    groupedProps: [
      "items: Pick<",
      "displayState: CommandPaletteResourceGroupsDisplayState;",
      "headings: Pick<",
      "handlers: Pick<",
    ],
    variantProps: ['mode: "recent";', 'mode: "search";'],
    forbiddenProps: ["showRecentResources", "showDevScenarios", "showFeeds", "showTags", "showArticles"],
  },
  {
    file: "src/components/reader/sidebar-content-sections.tsx",
    groupedProps: ["subscriptions: {", "navigation: {", "addFeedDialog: {", "feedTree: {", "tagSection: {"],
    variantProps: ["isVisible: boolean;", "isLoading: boolean;", "showSkeleton: boolean;"],
    forbiddenProps: ["showTagSection", "showFeedTreeSkeleton", "isFeedTreeLoading"],
  },
  {
    file: "src/components/reader/command-palette-results.tsx",
    groupedProps: ["items,", "visibility,", "headings,", "handlers,"],
    variantProps: ["visibility.recentActions || visibility.recentResources"],
    forbiddenProps: [
      "showRecentActions",
      "showRecentResources",
      "showActions",
      "showFeeds",
      "showTags",
      "showArticles",
    ],
  },
] as const;

function readRepoFile(path: string) {
  return readFileSync(join(repoRoot, path), "utf8");
}

function sliceSourceBetween(source: string, markers: readonly [string, string]) {
  const [startMarker, endMarker] = markers;
  const startIndex = source.indexOf(startMarker);
  const endIndex = source.indexOf(endMarker, startIndex + startMarker.length);

  expect(startIndex, `missing source start marker ${startMarker}`).not.toBe(-1);
  expect(endIndex, `missing source end marker ${endMarker}`).not.toBe(-1);

  return source.slice(startIndex, endIndex);
}

describe("reader boolean prop surface", () => {
  it("keeps react-doctor boolean prop candidates grouped or variant-based", () => {
    for (const contract of readerBooleanPropCandidateContracts) {
      const source = readRepoFile(contract.file);

      for (const groupedProp of contract.groupedProps) {
        expect(source, `${contract.file} should keep grouped prop ${groupedProp}`).toContain(groupedProp);
      }

      for (const variantProp of contract.variantProps) {
        expect(source, `${contract.file} should keep variant prop ${variantProp}`).toContain(variantProp);
      }

      const forbiddenSource =
        "forbiddenPropsScope" in contract ? sliceSourceBetween(source, contract.forbiddenPropsScope) : source;

      for (const forbiddenProp of contract.forbiddenProps) {
        expect(forbiddenSource, `${contract.file} should avoid direct boolean prop ${forbiddenProp}`).not.toContain(
          `${forbiddenProp}: boolean`,
        );
      }
    }
  });
});
