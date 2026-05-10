import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import preview, { STORYBOOK_PREVIEW_BACKGROUND_TOKEN } from "../../../.storybook/preview";
import * as storybookIndexPayload from "../../../e2e/storybook/storybook-index-payload";
import {
  createStorybookStoryIdIndex,
  getDuplicateStorybookStoryIdDiagnostics,
  sortedStorybookStoryIds,
} from "../../../e2e/storybook/storybook-index-payload";
import {
  setAppLikeScenarioStoryRuntime,
  setComponentIsolationStoryRuntime,
  setStoryTauriRuntimeMissing,
  setStoryTauriRuntimePresent,
} from "../../components/storybook/story-tauri-runtime";
import {
  STORYBOOK_EXPLORER_GROUPS,
  STORYBOOK_EXPLORER_ORDER,
  STORYBOOK_EXPLORER_SUBGROUPS,
  STORYBOOK_EXPLORER_TOP_LEVEL_GROUPS,
  STORYBOOK_EXPLORER_UI_REFERENCE_TITLES,
  storybookExplorerTitle,
} from "../../constants/storybook-explorer";

type StoryMetaModule = {
  default?: {
    title?: string;
  };
};

const storyModules = import.meta.glob<StoryMetaModule>("../../components/**/*.stories.tsx", {
  eager: true,
});

const storyMetas = Object.entries(storyModules)
  .map(([path, module]) => ({
    path,
    title: module.default?.title,
  }))
  .filter((entry): entry is { path: string; title: string } => typeof entry.title === "string");

const titles = storyMetas.map((entry) => entry.title);
const globalStyles = readFileSync(join(process.cwd(), "src/styles/global.css"), "utf8");
const uiReferenceSourcePaths = [
  "src/components/storybook/ui-reference-button-controls-canvas.stories.tsx",
  "src/components/storybook/ui-reference-canvas-specimens.tsx",
  "src/components/storybook/ui-reference-control-specimens.tsx",
  "src/components/storybook/ui-reference-foundation-specimens.tsx",
  "src/components/storybook/ui-reference-foundations-canvas.stories.tsx",
  "src/components/storybook/ui-reference-navigation-collections-canvas.stories.tsx",
  "src/components/storybook/ui-reference-navigation-specimens.tsx",
  "src/components/storybook/ui-reference-settings-canvas.stories.tsx",
  "src/components/storybook/ui-reference-settings-specimens.tsx",
  "src/components/storybook/ui-reference-settings-workspace-canvas.stories.tsx",
  "src/components/storybook/ui-reference-shell-overlay-canvas.stories.tsx",
  "src/components/storybook/ui-reference-shell-specimens.tsx",
  "src/components/storybook/ui-reference-workspace-patterns-canvas.stories.tsx",
  "src/components/storybook/ui-reference-workspace-specimens.tsx",
] as const;

type StorybookBackgroundName = "dark" | "light";

const appThemeCanvasSelectors = {
  dark: ":root.dark",
  light: ":root",
} satisfies Record<StorybookBackgroundName, string>;

function titlesUnder(group: string) {
  return titles.filter((title) => title.startsWith(`${group}/`));
}

function sortedStoryTitles(items: Iterable<string>): string[] {
  return sortedStorybookStoryIds(items);
}

function sortedStoryTitlesUnder(group: string): string[] {
  return sortedStoryTitles(titlesUnder(group));
}

function sortedStoryTitleGroups(items: Iterable<string>, segmentIndex: number): string[] {
  return sortedStoryTitles(new Set([...items].map((title) => title.split("/")[segmentIndex])));
}

function storyTitlesUnderRoleGroup(group: string) {
  const groupTitles = titlesUnder(group);

  return {
    groups: sortedStoryTitleGroups(groupTitles, 1),
    titles: groupTitles,
  };
}

function storybookBackgroundMap(): Record<StorybookBackgroundName, string | undefined> {
  const values = preview.parameters?.backgrounds?.values ?? [];
  const valueFor = (name: StorybookBackgroundName) =>
    values.find((value: { name?: unknown; value?: unknown }) => value.name === name && typeof value.value === "string")
      ?.value;

  return {
    dark: valueFor("dark"),
    light: valueFor("light"),
  };
}

function extractThemeCanvasValue(styles: string, selector: string): string {
  const block = extractCssBlock(styles, selector);
  const themeCanvasMatch = block.match(
    new RegExp(`${escapeRegExp(STORYBOOK_PREVIEW_BACKGROUND_TOKEN)}:\\s*(#[0-9a-fA-F]{6});`),
  );

  if (themeCanvasMatch === null) {
    throw new Error(`Missing ${STORYBOOK_PREVIEW_BACKGROUND_TOKEN} token for ${selector}`);
  }

  return themeCanvasMatch[1].toLowerCase();
}

function extractCssBlock(styles: string, selector: string): string {
  const blockMatch = styles.match(new RegExp(`${escapeRegExp(selector)}\\s*\\{(?<body>[\\s\\S]*?)\\n\\}`));

  if (blockMatch?.groups?.body === undefined) {
    throw new Error(`Missing CSS block for ${selector}`);
  }

  return blockMatch.groups.body;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

describe("Storybook Explorer organization", () => {
  it("keeps Storybook index payload public helpers explicit", () => {
    expect(Object.keys(storybookIndexPayload).toSorted()).toEqual([
      "createStorybookStoryIdIndex",
      "getDuplicateStorybookStoryIdDiagnostics",
      "getStorybookIframeStoryId",
      "getStorybookIframeUrl",
      "getStorybookIndexStoryIds",
      "sortedStorybookStoryIds",
      "uiReferenceCanvasStoryIds",
    ]);
  });

  it("defines an explicit Storybook Explorer order", () => {
    expect(preview.parameters?.options?.storySort).toMatchObject({
      order: STORYBOOK_EXPLORER_ORDER,
    });
  });

  it("keeps preview backgrounds aligned with app theme canvas tokens", () => {
    expect(preview.parameters?.backgrounds?.default).toBe("dark");
    expect(storybookBackgroundMap()).toEqual({
      dark: extractThemeCanvasValue(globalStyles, appThemeCanvasSelectors.dark),
      light: extractThemeCanvasValue(globalStyles, appThemeCanvasSelectors.light),
    });
  });

  it("keeps all story titles inside the approved top-level Explorer groups", () => {
    expect(sortedStoryTitleGroups(titles, 0)).toEqual(sortedStoryTitles(STORYBOOK_EXPLORER_TOP_LEVEL_GROUPS));
  });

  it("keeps stable sorted story id helpers from mutating the source order", () => {
    const sourceTitles = ["Reader/Zeta", "Reader/Alpha", "Reader/Beta"];

    expect(sortedStorybookStoryIds(sourceTitles)).toEqual(["Reader/Alpha", "Reader/Beta", "Reader/Zeta"]);
    expect(sourceTitles).toEqual(["Reader/Zeta", "Reader/Alpha", "Reader/Beta"]);
  });

  it("builds Storybook story id indexes with duplicate diagnostics", () => {
    const storyIds = ["reader-sidebar--default", "ui-reference-foundations-canvas--default", "reader-sidebar--default"];

    expect([...createStorybookStoryIdIndex(storyIds)]).toEqual([
      "reader-sidebar--default",
      "ui-reference-foundations-canvas--default",
    ]);
    expect(getDuplicateStorybookStoryIdDiagnostics(storyIds)).toEqual([{ id: "reader-sidebar--default", count: 2 }]);
  });

  it("extracts story ids from Storybook index payload versions with duplicate diagnostics", () => {
    expect(
      storybookIndexPayload.getStorybookIndexStoryIds({
        v: 5,
        entries: {
          "reader-sidebar--default": {
            id: "reader-sidebar--default",
            title: "Reader/Sidebar/ReaderSidebar",
            type: "story",
          },
          "ui-reference-foundations-canvas--default": {
            id: "ui-reference-foundations-canvas--default",
            title: "UI Reference/FoundationsCanvas",
            type: "docs",
          },
        },
      }),
    ).toEqual(["reader-sidebar--default", "ui-reference-foundations-canvas--default"]);
    expect(
      getDuplicateStorybookStoryIdDiagnostics([
        "reader-sidebar--default",
        "ui-reference-foundations-canvas--default",
        "reader-sidebar--default",
      ]),
    ).toEqual([{ id: "reader-sidebar--default", count: 2 }]);
  });

  it("rejects malformed Storybook index story fields", () => {
    expect(() =>
      storybookIndexPayload.getStorybookIndexStoryIds({
        entries: {
          "reader-sidebar--default": {
            id: 123,
          },
        },
      }),
    ).toThrow("Storybook index entries must contain story objects with string id fields");
    expect(() =>
      storybookIndexPayload.getStorybookIndexStoryIds({
        stories: {
          "reader-sidebar--default": {
            id: "reader-sidebar--default",
          },
        },
      }),
    ).toThrow("Storybook index payload must be an object with an object entries field");
  });

  it("extracts Storybook iframe story ids with malformed URL diagnostics", () => {
    expect(
      storybookIndexPayload.getStorybookIframeStoryId(
        storybookIndexPayload.getStorybookIframeUrl("ui-reference-foundations-canvas--default"),
      ),
    ).toBe("ui-reference-foundations-canvas--default");
    expect(
      storybookIndexPayload.getStorybookIframeStoryId(
        "/iframe.html?id=ui-reference-button-controls-canvas%2D%2Ddefault",
      ),
    ).toBe("ui-reference-button-controls-canvas--default");
    expect(() => storybookIndexPayload.getStorybookIframeStoryId("/iframe.html")).toThrow(
      "Storybook iframe URL must include a non-empty id query parameter",
    );
    expect(() => storybookIndexPayload.getStorybookIframeStoryId("/iframe.html?id=")).toThrow(
      "Storybook iframe URL must include a non-empty id query parameter",
    );
    expect(() =>
      storybookIndexPayload.getStorybookIframeStoryId(
        "/iframe.html?id=reader-sidebar--default&id=ui-reference-foundations-canvas--default",
      ),
    ).toThrow("Storybook iframe URL must include exactly one id query parameter");
    expect(() => storybookIndexPayload.getStorybookIframeStoryId("http://[::1")).toThrow(
      "Storybook iframe URL must include a non-empty id query parameter",
    );
  });

  it("uses document-aligned UI Reference story names", () => {
    expect(sortedStoryTitlesUnder(STORYBOOK_EXPLORER_GROUPS.uiReference)).toEqual(
      sortedStoryTitles(STORYBOOK_EXPLORER_UI_REFERENCE_TITLES),
    );
  });

  it("keeps UI Reference visible copy on typographic ellipsis", () => {
    const visibleThreePeriodMatches = uiReferenceSourcePaths.flatMap((path) => {
      const source = readFileSync(join(process.cwd(), path), "utf8");
      const matches = source.match(/["'`>][^"'`<>{}]*\.\.\.[^"'`<>{}]*/g) ?? [];
      return matches.map((match) => `${path}: ${match}`);
    });

    expect(visibleThreePeriodMatches).toEqual([]);
  });

  it("moves shared stories into dedicated role groups", () => {
    const sharedStories = storyTitlesUnderRoleGroup(STORYBOOK_EXPLORER_GROUPS.shared);

    expect(sharedStories.groups).toEqual(sortedStoryTitles(STORYBOOK_EXPLORER_SUBGROUPS.shared));
    expect(sharedStories.titles.every((title) => title.split("/").length === 3)).toBe(true);
  });

  it("keeps primitives in the dedicated group", () => {
    expect(titlesUnder(STORYBOOK_EXPLORER_GROUPS.primitives)).toEqual([
      storybookExplorerTitle(STORYBOOK_EXPLORER_GROUPS.primitives, "Button"),
    ]);
  });

  it("keeps story runtime scenario helpers available through the public Storybook helper path", () => {
    expect(typeof setComponentIsolationStoryRuntime).toBe("function");
    expect(typeof setAppLikeScenarioStoryRuntime).toBe("function");
    expect(typeof setStoryTauriRuntimeMissing).toBe("function");
    expect(typeof setStoryTauriRuntimePresent).toBe("function");
  });

  it("nests settings stories by role", () => {
    const settingsStories = storyTitlesUnderRoleGroup(STORYBOOK_EXPLORER_GROUPS.settings);

    expect(settingsStories.groups).toEqual(sortedStoryTitles(STORYBOOK_EXPLORER_SUBGROUPS.settings));
    expect(settingsStories.titles.every((title) => title.split("/").length === 3)).toBe(true);
    expect(settingsStories.titles).toContain(
      storybookExplorerTitle(STORYBOOK_EXPLORER_GROUPS.settings, "Page", "DataSettingsView"),
    );
    expect(settingsStories.titles).toContain(
      storybookExplorerTitle(STORYBOOK_EXPLORER_GROUPS.settings, "Page", "MuteSettingsView"),
    );
  });

  it("nests reader stories by role", () => {
    const readerStories = storyTitlesUnderRoleGroup(STORYBOOK_EXPLORER_GROUPS.reader);

    expect(readerStories.groups).toEqual(sortedStoryTitles(STORYBOOK_EXPLORER_SUBGROUPS.reader));
    expect(readerStories.titles.every((title) => title.split("/").length === 3)).toBe(true);
  });

  it("includes the sidebar feed-tree skeleton review story", () => {
    expect(titles).toContain(
      storybookExplorerTitle(STORYBOOK_EXPLORER_GROUPS.reader, "Sidebar", "SidebarFeedTreeSkeleton"),
    );
  });

  it("keeps subscriptions workspace stories in their own group", () => {
    const subscriptionsStories = storyTitlesUnderRoleGroup(STORYBOOK_EXPLORER_GROUPS.subscriptions);

    expect(subscriptionsStories.groups).toEqual(sortedStoryTitles(STORYBOOK_EXPLORER_SUBGROUPS.subscriptions));
    expect(subscriptionsStories.titles.every((title) => title.split("/").length === 3)).toBe(true);
    expect(subscriptionsStories.titles).toContain(
      storybookExplorerTitle(STORYBOOK_EXPLORER_GROUPS.subscriptions, "Summary", "SubscriptionsOverviewSummary"),
    );
    expect(subscriptionsStories.titles).toContain(
      storybookExplorerTitle(STORYBOOK_EXPLORER_GROUPS.subscriptions, "List", "SubscriptionsListPane"),
    );
    expect(subscriptionsStories.titles).toContain(
      storybookExplorerTitle(STORYBOOK_EXPLORER_GROUPS.subscriptions, "Detail", "SubscriptionDetailPane"),
    );
  });

  it("covers sidebar section menus and tag creation flows", () => {
    expect(titles).toContain(
      storybookExplorerTitle(STORYBOOK_EXPLORER_GROUPS.reader, "Menu", "SubscriptionsSectionContextMenuView"),
    );
    expect(titles).toContain(
      storybookExplorerTitle(STORYBOOK_EXPLORER_GROUPS.reader, "Menu", "TagSectionContextMenuView"),
    );
    expect(titles).toContain(storybookExplorerTitle(STORYBOOK_EXPLORER_GROUPS.reader, "Dialog", "CreateTagDialogView"));
  });

  it("isolates internal stories under debug or review only", () => {
    const internalStories = storyTitlesUnderRoleGroup(STORYBOOK_EXPLORER_GROUPS.internal);

    expect(internalStories.groups, internalStories.titles.join("\n")).toEqual(
      sortedStoryTitles(STORYBOOK_EXPLORER_SUBGROUPS.internal),
    );
    expect(internalStories.titles.every((title) => title.split("/").length === 3)).toBe(true);
    expect(internalStories.titles).toContain(
      storybookExplorerTitle(STORYBOOK_EXPLORER_GROUPS.internal, "Review", "ArticleReadingRhythm"),
    );
  });

  it("keeps story title top-levels aligned with component folders", () => {
    const mismatches = storyMetas.flatMap(({ path, title }) => {
      const expectedGroup = expectedTopLevelGroupForPath(path, title);
      if (expectedGroup === null || title.startsWith(`${expectedGroup}/`)) {
        return [];
      }

      return [`${path} -> ${title} should be under ${expectedGroup}`];
    });

    expect(mismatches).toEqual([]);
  });
});

function expectedTopLevelGroupForPath(path: string, title: string) {
  if (path.startsWith("../../components/storybook/")) {
    return STORYBOOK_EXPLORER_GROUPS.uiReference;
  }
  if (path.startsWith("../../components/shared/")) {
    return STORYBOOK_EXPLORER_GROUPS.shared;
  }
  if (path.startsWith("../../components/ui/")) {
    return STORYBOOK_EXPLORER_GROUPS.primitives;
  }
  if (path.startsWith("../../components/settings/")) {
    return STORYBOOK_EXPLORER_GROUPS.settings;
  }
  if (path.startsWith("../../components/subscriptions-index/")) {
    return STORYBOOK_EXPLORER_GROUPS.subscriptions;
  }
  if (path.startsWith("../../components/debug/")) {
    return STORYBOOK_EXPLORER_GROUPS.internal;
  }
  if (path.startsWith("../../components/reader/")) {
    const internalReviewPrefix = storybookExplorerTitle(STORYBOOK_EXPLORER_GROUPS.internal, "Review");
    return title.startsWith(`${internalReviewPrefix}/`)
      ? STORYBOOK_EXPLORER_GROUPS.internal
      : STORYBOOK_EXPLORER_GROUPS.reader;
  }

  return null;
}
