import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CommandPaletteResourceGroups } from "@/components/reader/command-palette-resource-groups";
import { Command, CommandList } from "@/components/ui/command";
import { DEV_SCENARIO_ID } from "@/dev/scenario-ids";
import { sampleArticles, sampleFeeds, sampleTags } from "../../../tests/helpers/fixtures";

type CommandPaletteResourceGroupsProps = Parameters<typeof CommandPaletteResourceGroups>[0];
type CommandPaletteResourceGroupsOverrides = Omit<
  Partial<CommandPaletteResourceGroupsProps>,
  "items" | "displayState" | "headings" | "handlers"
> & {
  items?: Partial<CommandPaletteResourceGroupsProps["items"]>;
  displayState?: CommandPaletteResourceGroupsProps["displayState"];
  headings?: Partial<CommandPaletteResourceGroupsProps["headings"]>;
  handlers?: Partial<CommandPaletteResourceGroupsProps["handlers"]>;
};

function renderResourceGroups(overrides: CommandPaletteResourceGroupsOverrides = {}) {
  const props = {
    items: {
      filteredDevScenarios: [],
      filteredFeeds: [],
      filteredTags: [],
      articles: [],
      recentFeeds: [],
      recentTags: [],
      recentArticles: [],
      ...overrides.items,
    },
    displayState: overrides.displayState ?? {
      mode: "search",
      groups: {
        devScenarios: false,
        feeds: true,
        tags: true,
        articles: true,
      },
    },
    headings: {
      devScenariosHeading: "Dev Scenarios",
      feedsHeading: "Feeds",
      tagsHeading: "Tags",
      articlesHeading: "Articles",
      ...overrides.headings,
    },
    getCommandItemValue: (kind, id) => `${kind}:${id}`,
    handlers: {
      onDevScenarioSelect: vi.fn(),
      onFeedSelect: vi.fn(),
      onTagSelect: vi.fn(),
      onArticleSelect: vi.fn(),
      ...overrides.handlers,
    },
  } satisfies CommandPaletteResourceGroupsProps;

  return render(
    <Command>
      <CommandList>
        <CommandPaletteResourceGroups {...props} />
      </CommandList>
    </Command>,
  );
}

describe("CommandPaletteResourceGroups", () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    vi.stubGlobal(
      "ResizeObserver",
      class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  });

  it("renders recent resource entries while recent actions are visible", () => {
    renderResourceGroups({
      items: {
        filteredFeeds: [sampleFeeds[1]],
        filteredTags: [sampleTags[1]],
        articles: [sampleArticles[1]],
        recentFeeds: [sampleFeeds[0]],
        recentTags: [sampleTags[0]],
        recentArticles: [sampleArticles[0]],
      },
      displayState: {
        mode: "recent",
        groups: {
          feeds: true,
          tags: true,
          articles: true,
        },
      },
    });

    expect(screen.getByRole("group", { name: "Feeds" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Tech Blog/ })).toBeInTheDocument();
    expect(screen.getByText("https://example.com")).toHaveClass("text-foreground-soft");
    expect(screen.queryByRole("option", { name: /News/ })).not.toBeInTheDocument();

    const tagsGroup = screen.getByRole("group", { name: "Tags" });
    expect(tagsGroup).toBeInTheDocument();
    expect(within(tagsGroup).getByRole("option", { name: /Tech/ })).toBeInTheDocument();
    expect(screen.getByText("#6f8eb8")).toHaveClass("text-foreground-soft");
    expect(screen.queryByRole("option", { name: /Later/ })).not.toBeInTheDocument();

    expect(screen.getByRole("group", { name: "Articles" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /First Article/ })).toBeInTheDocument();
    expect(screen.getByText("https://example.com/1")).toHaveClass("text-foreground-soft");
    expect(screen.queryByRole("option", { name: /Second Article/ })).not.toBeInTheDocument();
  });

  it("uses the localized dev scenarios heading prop", () => {
    renderResourceGroups({
      items: {
        filteredDevScenarios: [
          {
            id: DEV_SCENARIO_ID.openAddFeedDialog,
            title: "Open add feed dialog",
            keywords: ["add", "feed"],
          },
        ],
      },
      displayState: {
        mode: "search",
        groups: {
          devScenarios: true,
          feeds: true,
          tags: true,
          articles: true,
        },
      },
      headings: {
        devScenariosHeading: "Development States",
      },
    });

    expect(screen.getByRole("group", { name: "Development States" })).toBeInTheDocument();
    expect(screen.queryByText("Dev Scenarios")).not.toBeInTheDocument();
  });
});
