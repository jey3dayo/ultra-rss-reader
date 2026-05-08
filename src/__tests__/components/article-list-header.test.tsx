import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createWrapper } from "@tests/helpers/create-wrapper";
import { createRef } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ArticleListHeader } from "@/components/reader/article-list-header";
import { resolveArticleListHeaderControlAvailability } from "@/components/reader/hooks/article-list/use-article-list-header-controls";
import { useUiStore } from "@/stores/ui-store";

describe("ArticleListHeader", () => {
  beforeEach(() => {
    useUiStore.setState({ layoutMode: "wide" });
  });

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

  it("keeps the drag region separate from interactive controls", () => {
    const { container } = render(
      <ArticleListHeader
        showSearch
        searchQuery=""
        searchInputRef={createRef<HTMLInputElement>()}
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

  it("closes search when pressing Escape in the focused search input", async () => {
    const user = userEvent.setup();
    const onCloseSearch = vi.fn();

    render(
      <ArticleListHeader
        showSearch
        searchQuery=""
        searchInputRef={createRef<HTMLInputElement>()}
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

    const searchInput = screen.getByRole("textbox", { name: "Search articles" });
    searchInput.focus();

    await user.keyboard("{Escape}");

    expect(onCloseSearch).toHaveBeenCalledTimes(1);
  });

  it("shows a sidebar toggle button when requested", async () => {
    const user = userEvent.setup();
    const onToggleSidebar = vi.fn();

    render(
      <ArticleListHeader
        showSearch={false}
        searchQuery=""
        searchInputRef={createRef<HTMLInputElement>()}
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
