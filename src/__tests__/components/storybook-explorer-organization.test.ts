import { describe, expect, it } from "vitest";
import preview from "../../../.storybook/preview";

type StoryMetaModule = {
  default?: {
    title?: string;
  };
};

const storyModules = import.meta.glob("../../components/**/*.stories.tsx", {
  eager: true,
}) as Record<string, StoryMetaModule>;

const storyMetas = Object.entries(storyModules)
  .map(([path, module]) => ({
    path,
    title: module.default?.title,
  }))
  .filter((entry): entry is { path: string; title: string } => typeof entry.title === "string");

const titles = storyMetas.map((entry) => entry.title);

const uiReferenceTitles = [
  "UI Reference/Foundations Canvas",
  "UI Reference/Input Controls Canvas",
  "UI Reference/Shell & Overlay Canvas",
  "UI Reference/Navigation & Collections Canvas",
  "UI Reference/View Specimens Canvas",
] as const;

const sharedGroups = ["Layout", "Fields", "Rows", "Controls", "Dialogs", "Navigation", "Feedback"] as const;
const settingsGroups = ["Page", "Section", "Nav"] as const;
const readerGroups = ["Article", "Sidebar", "Dialog", "Menu", "Browser"] as const;
const internalGroups = ["Debug", "Review"] as const;
const topLevelGroups = [
  "UI Reference",
  "Shared",
  "Primitives",
  "Settings",
  "Reader",
  "Feed Cleanup",
  "Internal",
] as const;

function titlesUnder(group: string) {
  return titles.filter((title) => title.startsWith(`${group}/`));
}

describe("Storybook Explorer organization", () => {
  it("defines an explicit Storybook Explorer order", () => {
    expect(preview.parameters?.options?.storySort).toMatchObject({
      order: [
        "UI Reference",
        [
          "Foundations Canvas",
          "Input Controls Canvas",
          "Shell & Overlay Canvas",
          "Navigation & Collections Canvas",
          "View Specimens Canvas",
        ],
        "Shared",
        ["Layout", "Fields", "Rows", "Controls", "Dialogs", "Navigation", "Feedback"],
        "Primitives",
        "Settings",
        ["Page", "Section", "Nav"],
        "Reader",
        ["Article", "Sidebar", "Dialog", "Menu", "Browser"],
        "Feed Cleanup",
        "Internal",
        ["Debug", "Review"],
      ],
    });
  });

  it("keeps all story titles inside the approved top-level Explorer groups", () => {
    const actualGroups = [...new Set(titles.map((title) => title.split("/")[0]))].sort();
    expect(actualGroups).toEqual([...topLevelGroups].sort());
  });

  it("uses document-aligned UI Reference story names", () => {
    expect([...titlesUnder("UI Reference")].sort()).toEqual([...uiReferenceTitles].sort());
  });

  it("moves shared stories into dedicated role groups", () => {
    const sharedTitles = titlesUnder("Shared");
    const actualGroups = [...new Set(sharedTitles.map((title) => title.split("/")[1]))].sort();

    expect(actualGroups).toEqual([...sharedGroups].sort());
    expect(sharedTitles.every((title) => title.split("/").length === 3)).toBe(true);
  });

  it("keeps primitives in the dedicated group", () => {
    expect(titlesUnder("Primitives")).toEqual(["Primitives/Button"]);
  });

  it("nests settings stories by role", () => {
    const settingsTitles = titlesUnder("Settings");
    const actualGroups = [...new Set(settingsTitles.map((title) => title.split("/")[1]))].sort();

    expect(actualGroups).toEqual([...settingsGroups].sort());
    expect(settingsTitles.every((title) => title.split("/").length === 3)).toBe(true);
  });

  it("nests reader stories by role", () => {
    const readerTitles = titlesUnder("Reader");
    const actualGroups = [...new Set(readerTitles.map((title) => title.split("/")[1]))].sort();

    expect(actualGroups).toEqual([...readerGroups].sort());
    expect(readerTitles.every((title) => title.split("/").length === 3)).toBe(true);
  });

  it("includes the sidebar feed-tree skeleton review story", () => {
    expect(titles).toContain("Reader/Sidebar/SidebarFeedTreeSkeleton");
  });

  it("keeps feed cleanup stories compact and panel-oriented", () => {
    expect([...titlesUnder("Feed Cleanup")].sort()).toEqual(
      ["Feed Cleanup/OverviewPanel", "Feed Cleanup/QueuePanel", "Feed Cleanup/ReviewPanel"].sort(),
    );
  });

  it("isolates internal stories under debug or review only", () => {
    const internalTitles = titlesUnder("Internal");
    const actualGroups = [...new Set(internalTitles.map((title) => title.split("/")[1]))].sort();

    expect(actualGroups).toEqual([...internalGroups].sort());
    expect(internalTitles.every((title) => title.split("/").length === 3)).toBe(true);
  });
});
