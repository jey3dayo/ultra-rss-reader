import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import preview, { STORYBOOK_PREVIEW_BACKGROUND_TOKEN } from "../../../.storybook/preview";
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

function sortedCopy<T>(items: Iterable<T>, compareFn?: (left: T, right: T) => number): T[] {
  return [...items].sort(compareFn);
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
    const actualGroups = sortedCopy(new Set(titles.map((title) => title.split("/")[0])));
    expect(actualGroups).toEqual(sortedCopy(STORYBOOK_EXPLORER_TOP_LEVEL_GROUPS));
  });

  it("uses document-aligned UI Reference story names", () => {
    expect(sortedCopy(titlesUnder(STORYBOOK_EXPLORER_GROUPS.uiReference))).toEqual(
      sortedCopy(STORYBOOK_EXPLORER_UI_REFERENCE_TITLES),
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
    const sharedTitles = titlesUnder(STORYBOOK_EXPLORER_GROUPS.shared);
    const actualGroups = sortedCopy(new Set(sharedTitles.map((title) => title.split("/")[1])));

    expect(actualGroups).toEqual(sortedCopy(STORYBOOK_EXPLORER_SUBGROUPS.shared));
    expect(sharedTitles.every((title) => title.split("/").length === 3)).toBe(true);
  });

  it("keeps primitives in the dedicated group", () => {
    expect(titlesUnder(STORYBOOK_EXPLORER_GROUPS.primitives)).toEqual([
      storybookExplorerTitle(STORYBOOK_EXPLORER_GROUPS.primitives, "Button"),
    ]);
  });

  it("nests settings stories by role", () => {
    const settingsTitles = titlesUnder(STORYBOOK_EXPLORER_GROUPS.settings);
    const actualGroups = sortedCopy(new Set(settingsTitles.map((title) => title.split("/")[1])));

    expect(actualGroups).toEqual(sortedCopy(STORYBOOK_EXPLORER_SUBGROUPS.settings));
    expect(settingsTitles.every((title) => title.split("/").length === 3)).toBe(true);
    expect(settingsTitles).toContain(
      storybookExplorerTitle(STORYBOOK_EXPLORER_GROUPS.settings, "Page", "DataSettingsView"),
    );
    expect(settingsTitles).toContain(
      storybookExplorerTitle(STORYBOOK_EXPLORER_GROUPS.settings, "Page", "MuteSettingsView"),
    );
  });

  it("nests reader stories by role", () => {
    const readerTitles = titlesUnder(STORYBOOK_EXPLORER_GROUPS.reader);
    const actualGroups = sortedCopy(new Set(readerTitles.map((title) => title.split("/")[1])));

    expect(actualGroups).toEqual(sortedCopy(STORYBOOK_EXPLORER_SUBGROUPS.reader));
    expect(readerTitles.every((title) => title.split("/").length === 3)).toBe(true);
  });

  it("includes the sidebar feed-tree skeleton review story", () => {
    expect(titles).toContain(
      storybookExplorerTitle(STORYBOOK_EXPLORER_GROUPS.reader, "Sidebar", "SidebarFeedTreeSkeleton"),
    );
  });

  it("keeps subscriptions workspace stories in their own group", () => {
    const subscriptionsTitles = titlesUnder(STORYBOOK_EXPLORER_GROUPS.subscriptions);
    const actualGroups = sortedCopy(new Set(subscriptionsTitles.map((title) => title.split("/")[1])));

    expect(actualGroups).toEqual(sortedCopy(STORYBOOK_EXPLORER_SUBGROUPS.subscriptions));
    expect(subscriptionsTitles.every((title) => title.split("/").length === 3)).toBe(true);
    expect(subscriptionsTitles).toContain(
      storybookExplorerTitle(STORYBOOK_EXPLORER_GROUPS.subscriptions, "Summary", "SubscriptionsOverviewSummary"),
    );
    expect(subscriptionsTitles).toContain(
      storybookExplorerTitle(STORYBOOK_EXPLORER_GROUPS.subscriptions, "List", "SubscriptionsListPane"),
    );
    expect(subscriptionsTitles).toContain(
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
    const internalTitles = titlesUnder(STORYBOOK_EXPLORER_GROUPS.internal);
    const actualGroups = sortedCopy(new Set(internalTitles.map((title) => title.split("/")[1])));

    expect(actualGroups, internalTitles.join("\n")).toEqual(sortedCopy(STORYBOOK_EXPLORER_SUBGROUPS.internal));
    expect(internalTitles.every((title) => title.split("/").length === 3)).toBe(true);
    expect(internalTitles).toContain(
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
