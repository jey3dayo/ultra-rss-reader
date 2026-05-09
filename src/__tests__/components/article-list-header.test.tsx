import { act, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createWrapper } from "@tests/helpers/create-wrapper";
import { createRef, useRef, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ArticleListHeader } from "@/components/reader/article-list-header";
import {
  resolveArticleListHeaderControlAvailability,
  useArticleListHeaderControls,
} from "@/components/reader/hooks/article-list/use-article-list-header-controls";
import type { LayoutMode } from "@/lib/layout/layout-state.types";
import { useUiStore } from "@/stores/ui-store";

const articleListHeaderLabels = {
  markAllReadLabel: "Mark all as read",
  markAllReadButtonText: "Read",
  searchArticlesLabel: "Search articles",
  searchArticlesButtonText: "Search",
  closeSearchLabel: "Close search",
  searchArticlesPlaceholder: "Search articles…",
};

describe("ArticleListHeader", () => {
  beforeEach(() => {
    useUiStore.setState({ layoutMode: "wide" });
  });

  type HeaderControlsHookProps = {
    layoutMode: LayoutMode;
    sidebarOpen: boolean;
  };

  it("resolves header control availability without binding it to mutations", () => {
    expect(
      resolveArticleListHeaderControlAvailability({
        layoutMode: "wide",
        sidebarOpen: true,
        resolvedFeedId: "feed-1",
        showSearch: true,
      }),
    ).toEqual({
      showSidebarButton: true,
      isSidebarTogglePressed: true,
      showFeedDisplaySelect: true,
      showMarkAllRead: true,
      showSearchToggle: true,
      showCloseSearch: true,
    });

    expect(
      resolveArticleListHeaderControlAvailability({
        layoutMode: "mobile",
        sidebarOpen: false,
        resolvedFeedId: null,
        showSearch: false,
      }),
    ).toEqual({
      showSidebarButton: true,
      isSidebarTogglePressed: undefined,
      showFeedDisplaySelect: false,
      showMarkAllRead: true,
      showSearchToggle: true,
      showCloseSearch: false,
    });
  });

  it("keeps sidebar controls as toggle on wide and open-only on compact and mobile", () => {
    const openSidebar = vi.fn();
    const toggleSidebar = vi.fn();
    const defaultParams = {
      sidebarSubscriptionsLabel: "Subscriptions",
      feedDisplayLabel: "Feed display",
      showSidebarLabel: "Show sidebar",
      hideSidebarLabel: "Hide sidebar",
      resolvedFeedId: "feed-1",
      selectedFeedDisplayPreset: "standard" as const,
      displayPresetOptions: [{ value: "standard" as const, label: "Standard" }],
      onSetDisplayMode: vi.fn(),
      openSidebar,
      toggleSidebar,
    };
    const initialProps: HeaderControlsHookProps = {
      layoutMode: "wide",
      sidebarOpen: true,
    };

    const { result, rerender } = renderHook(
      ({ layoutMode, sidebarOpen }) =>
        useArticleListHeaderControls({
          ...defaultParams,
          layoutMode,
          sidebarOpen,
        }),
      {
        initialProps,
      },
    );

    expect(result.current.showSidebarButton).toBe(true);
    expect(result.current.sidebarButtonLabel).toBe("Hide sidebar");
    expect(result.current.sidebarButtonText).toBeUndefined();
    expect(result.current.isSidebarVisible).toBe(true);

    act(() => {
      result.current.handleSidebarToggle();
    });

    expect(toggleSidebar).toHaveBeenCalledTimes(1);
    expect(openSidebar).not.toHaveBeenCalled();

    rerender({ layoutMode: "compact", sidebarOpen: false });

    expect(result.current.showSidebarButton).toBe(true);
    expect(result.current.sidebarButtonLabel).toBe("Show sidebar");
    expect(result.current.sidebarButtonText).toBe("Subscriptions");
    expect(result.current.isSidebarVisible).toBeUndefined();

    act(() => {
      result.current.handleSidebarToggle();
    });

    expect(toggleSidebar).toHaveBeenCalledTimes(1);
    expect(openSidebar).toHaveBeenCalledTimes(1);

    rerender({ layoutMode: "mobile", sidebarOpen: false });

    expect(result.current.showSidebarButton).toBe(true);
    expect(result.current.sidebarButtonLabel).toBe("Show sidebar");
    expect(result.current.sidebarButtonText).toBeUndefined();
    expect(result.current.isSidebarVisible).toBeUndefined();

    act(() => {
      result.current.handleSidebarToggle();
    });

    expect(toggleSidebar).toHaveBeenCalledTimes(1);
    expect(openSidebar).toHaveBeenCalledTimes(2);
  });

  it("omits feed mode control when no concrete feed is selected", () => {
    const { result, rerender } = renderHook(
      ({ resolvedFeedId }) =>
        useArticleListHeaderControls({
          layoutMode: "wide",
          sidebarOpen: true,
          sidebarSubscriptionsLabel: "Subscriptions",
          feedDisplayLabel: "Feed display",
          showSidebarLabel: "Show sidebar",
          hideSidebarLabel: "Hide sidebar",
          resolvedFeedId,
          selectedFeedDisplayPreset: "standard",
          displayPresetOptions: [{ value: "standard", label: "Standard" }],
          onSetDisplayMode: vi.fn(),
          openSidebar: vi.fn(),
          toggleSidebar: vi.fn(),
        }),
      {
        initialProps: {
          resolvedFeedId: null as string | null,
        },
      },
    );

    expect(result.current.feedModeControl).toBeNull();

    rerender({ resolvedFeedId: "feed-1" });

    expect(result.current.feedModeControl).not.toBeNull();
  });

  it("keeps the drag region separate from interactive controls", () => {
    const { container } = render(
      <ArticleListHeader
        showSearch
        searchQuery=""
        searchInputRef={createRef<HTMLInputElement>()}
        labels={articleListHeaderLabels}
        showSidebarButton={false}
        sidebarButtonLabel="Show sidebar"
        onMarkAllRead={vi.fn()}
        onToggleSidebar={vi.fn()}
        onToggleSearch={vi.fn()}
        onCloseSearch={vi.fn()}
        onSearchQueryChange={vi.fn()}
      />,
      { wrapper: createWrapper() },
    );

    const header = container.firstElementChild;
    expect(header).not.toHaveAttribute("data-tauri-drag-region");
    expect(header?.querySelector("[data-tauri-drag-region]")).not.toBeNull();
  });

  it("labels the search input accessibly and uses an ellipsis placeholder", () => {
    render(
      <ArticleListHeader
        showSearch
        searchQuery=""
        searchInputRef={createRef<HTMLInputElement>()}
        labels={articleListHeaderLabels}
        showSidebarButton={false}
        sidebarButtonLabel="Show sidebar"
        onMarkAllRead={vi.fn()}
        onToggleSidebar={vi.fn()}
        onToggleSearch={vi.fn()}
        onCloseSearch={vi.fn()}
        onSearchQueryChange={vi.fn()}
      />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByRole("textbox", { name: "Search articles" })).toHaveAttribute("placeholder", "Search articles…");
    expect(screen.getByRole("textbox", { name: "Search articles" })).toHaveClass(
      "focus:ring-2",
      "focus:ring-[color:color-mix(in_srgb,var(--foreground)_10%,transparent)]",
      "focus-visible:ring-2",
      "focus-visible:ring-[color:color-mix(in_srgb,var(--foreground)_10%,transparent)]",
    );
    expect(screen.getByTestId("article-list-search-motion")).toHaveClass("motion-content-swap");
    expect(screen.getByTestId("article-list-search-motion")).toHaveAttribute("data-motion-phase", "entering");
  });

  it("uses action and search labels from view props", () => {
    render(
      <ArticleListHeader
        showSearch
        searchQuery=""
        searchInputRef={createRef<HTMLInputElement>()}
        labels={{
          markAllReadLabel: "Props mark all",
          markAllReadButtonText: "Props read",
          searchArticlesLabel: "Props search",
          searchArticlesButtonText: "Props search short",
          closeSearchLabel: "Props close search",
          searchArticlesPlaceholder: "Props search placeholder",
        }}
        showSidebarButton={false}
        sidebarButtonLabel="Show sidebar"
        onMarkAllRead={vi.fn()}
        onToggleSidebar={vi.fn()}
        onToggleSearch={vi.fn()}
        onCloseSearch={vi.fn()}
        onSearchQueryChange={vi.fn()}
      />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByRole("button", { name: "Props mark all" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Props search" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Props close search" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Props search" })).toHaveAttribute(
      "placeholder",
      "Props search placeholder",
    );
  });

  it("closes search when pressing Escape in the focused search input", async () => {
    const user = userEvent.setup();
    const onCloseSearch = vi.fn();

    render(
      <ArticleListHeader
        showSearch
        searchQuery=""
        searchInputRef={createRef<HTMLInputElement>()}
        labels={articleListHeaderLabels}
        showSidebarButton={false}
        sidebarButtonLabel="Show sidebar"
        onMarkAllRead={vi.fn()}
        onToggleSidebar={vi.fn()}
        onToggleSearch={vi.fn()}
        onCloseSearch={onCloseSearch}
        onSearchQueryChange={vi.fn()}
      />,
      { wrapper: createWrapper() },
    );

    const searchInput = screen.getByRole("textbox", {
      name: "Search articles",
    });
    searchInput.focus();

    await user.keyboard("{Escape}");

    expect(onCloseSearch).toHaveBeenCalledTimes(1);
  });

  it("returns focus to the search toggle when Escape closes the search input", async () => {
    const user = userEvent.setup();

    function ControlledHeader() {
      const [showSearch, setShowSearch] = useState(true);
      const searchInputRef = useRef<HTMLInputElement>(null);

      return (
        <ArticleListHeader
          showSearch={showSearch}
          searchQuery=""
          searchInputRef={searchInputRef}
          labels={articleListHeaderLabels}
          showSidebarButton={false}
          sidebarButtonLabel="Show sidebar"
          onMarkAllRead={vi.fn()}
          onToggleSidebar={vi.fn()}
          onToggleSearch={() => setShowSearch(true)}
          onCloseSearch={() => setShowSearch(false)}
          onSearchQueryChange={vi.fn()}
        />
      );
    }

    render(<ControlledHeader />, { wrapper: createWrapper() });

    const searchInput = screen.getByRole("textbox", {
      name: /^(Search articles|search_articles)$/,
    });
    searchInput.focus();

    await user.keyboard("{Escape}");

    expect(
      screen.queryByRole("textbox", {
        name: /^(Search articles|search_articles)$/,
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: /^(Search articles|search_articles)$/,
      }),
    ).toHaveFocus();
  });

  it("shows a sidebar toggle button when requested", async () => {
    const user = userEvent.setup();
    const onToggleSidebar = vi.fn();

    render(
      <ArticleListHeader
        showSearch={false}
        searchQuery=""
        searchInputRef={createRef<HTMLInputElement>()}
        labels={articleListHeaderLabels}
        showSidebarButton
        sidebarButtonLabel="Hide sidebar"
        isSidebarVisible
        onMarkAllRead={vi.fn()}
        onToggleSidebar={onToggleSidebar}
        onToggleSearch={vi.fn()}
        onCloseSearch={vi.fn()}
        onSearchQueryChange={vi.fn()}
      />,
      { wrapper: createWrapper() },
    );

    const button = screen.getByRole("button", { name: "Hide sidebar" });
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(button).toHaveClass("bg-surface-3/88", "text-foreground");

    await user.click(button);

    expect(onToggleSidebar).toHaveBeenCalledTimes(1);
  });

  it("places the sidebar toggle on the left edge of the header", () => {
    const { container } = render(
      <ArticleListHeader
        showSearch={false}
        searchQuery=""
        searchInputRef={createRef<HTMLInputElement>()}
        labels={articleListHeaderLabels}
        showSidebarButton
        sidebarButtonLabel="Hide sidebar"
        isSidebarVisible
        onMarkAllRead={vi.fn()}
        onToggleSidebar={vi.fn()}
        onToggleSearch={vi.fn()}
        onCloseSearch={vi.fn()}
        onSearchQueryChange={vi.fn()}
      />,
      { wrapper: createWrapper() },
    );

    const header = container.firstElementChild;
    expect(header?.firstElementChild).toContainElement(screen.getByRole("button", { name: "Hide sidebar" }));
  });

  it("can show a compact sidebar affordance label next to the icon", () => {
    render(
      <ArticleListHeader
        showSearch={false}
        searchQuery=""
        searchInputRef={createRef<HTMLInputElement>()}
        labels={articleListHeaderLabels}
        showSidebarButton
        sidebarButtonLabel="Show sidebar"
        sidebarButtonText="Subscriptions"
        onMarkAllRead={vi.fn()}
        onToggleSidebar={vi.fn()}
        onToggleSearch={vi.fn()}
        onCloseSearch={vi.fn()}
        onSearchQueryChange={vi.fn()}
      />,
      { wrapper: createWrapper() },
    );

    const button = screen.getByRole("button", { name: "Show sidebar" });

    expect(button).toHaveTextContent("Subscriptions");
    expect(button).toHaveClass("text-foreground-soft");
  });

  it("uses icon-dominant toolbar controls in mobile layout", () => {
    useUiStore.setState({ layoutMode: "mobile" });

    render(
      <ArticleListHeader
        showSearch={false}
        searchQuery=""
        searchInputRef={createRef<HTMLInputElement>()}
        labels={articleListHeaderLabels}
        showSidebarButton={false}
        sidebarButtonLabel="Show sidebar"
        onMarkAllRead={vi.fn()}
        onToggleSidebar={vi.fn()}
        onToggleSearch={vi.fn()}
        onCloseSearch={vi.fn()}
        onSearchQueryChange={vi.fn()}
      />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByRole("button", { name: "Mark all as read" })).not.toHaveTextContent("Read");
    expect(screen.getByRole("button", { name: "Mark all as read" })).toHaveClass("size-11", "rounded-md");
    expect(screen.getByRole("button", { name: "Mark all as read" })).toHaveClass("text-foreground-soft");
    expect(screen.getByRole("button", { name: "Search articles" })).not.toHaveTextContent("Search");
    expect(screen.getByRole("button", { name: "Search articles" })).toHaveClass("size-11", "rounded-md");
    expect(screen.getByRole("button", { name: "Search articles" })).toHaveClass("text-foreground-soft");
  });
});
