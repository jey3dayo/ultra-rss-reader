import { describe, expect, it } from "vitest";
import focusDebugHudMeta from "@/components/debug/focus-debug-hud-view.stories";
import articleGroupsMeta from "@/components/reader/article-groups-view.stories";
import articleListScreenMeta from "@/components/reader/article-list-screen-view.stories";
import feedItemMeta from "@/components/reader/feed-item.stories";
import feedTreeMeta from "@/components/reader/feed-tree-view.stories";
import folderSectionMeta from "@/components/reader/folder-section.stories";
import sidebarSelectionReviewMeta from "@/components/reader/sidebar-selection-review.stories";
import accountDetailMeta from "@/components/settings/account-detail-view.stories";
import settingsComponentsMeta from "@/components/settings/settings-components.stories";
import settingsNavMeta from "@/components/settings/settings-nav-view.stories";
import inputControlsMeta from "@/components/storybook/ui-reference-settings-canvas.stories";
import viewSpecimensMeta from "@/components/storybook/ui-reference-workspace-patterns-canvas.stories";
import buttonMeta from "@/components/ui/button.stories";
import preview from "../../../.storybook/preview";

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

  it("uses document-aligned UI Reference story names", () => {
    expect(inputControlsMeta.title).toBe("UI Reference/Input Controls Canvas");
    expect(viewSpecimensMeta.title).toBe("UI Reference/View Specimens Canvas");
  });

  it("moves primitives into the dedicated group", () => {
    expect(buttonMeta.title).toBe("Primitives/Button");
  });

  it("nests reader stories by role", () => {
    expect(articleGroupsMeta.title).toBe("Reader/Article/ArticleGroupsView");
    expect(articleListScreenMeta.title).toBe("Reader/Article/ArticleListScreenView");
    expect(feedTreeMeta.title).toBe("Reader/Sidebar/FeedTreeView");
    expect(feedItemMeta.title).toBe("Reader/Sidebar/FeedItemView");
    expect(folderSectionMeta.title).toBe("Reader/Sidebar/FolderSectionView");
  });

  it("nests settings stories by role", () => {
    expect(accountDetailMeta.title).toBe("Settings/Page/AccountDetailView");
    expect(settingsComponentsMeta.title).toBe("Settings/Section/SectionHeading");
    expect(settingsNavMeta.title).toBe("Settings/Nav/SettingsNavView");
  });

  it("isolates internal debug and review stories from normal Explorer groups", () => {
    expect(focusDebugHudMeta.title).toBe("Internal/Debug/FocusDebugHudView");
    expect(sidebarSelectionReviewMeta.title).toBe("Internal/Review/SidebarSelectionReview");
  });
});
