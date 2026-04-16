import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ArticleListHeader } from "@/components/reader/article-list-header";
import { useUiStore } from "@/stores/ui-store";
import { createWrapper } from "../../../tests/helpers/create-wrapper";

describe("ArticleListHeader", () => {
  beforeEach(() => {
    useUiStore.setState({ layoutMode: "wide" });
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
    expect(button).toHaveClass("bg-surface-1/72", "text-foreground");

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

  it("shows short action labels in mobile layout", () => {
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

    expect(screen.getByRole("button", { name: "Mark all as read" })).toHaveTextContent("Read");
    expect(screen.getByRole("button", { name: "Mark all as read" })).toHaveClass("h-11");
    expect(screen.getByRole("button", { name: "Mark all as read" })).toHaveClass("text-sm");
    expect(screen.getByRole("button", { name: "Mark all as read" })).toHaveClass("text-foreground-soft");
    expect(screen.getByRole("button", { name: "Search articles" })).toHaveTextContent("Search");
    expect(screen.getByRole("button", { name: "Search articles" })).toHaveClass("h-11");
    expect(screen.getByRole("button", { name: "Search articles" })).toHaveClass("text-sm");
    expect(screen.getByRole("button", { name: "Search articles" })).toHaveClass("text-foreground-soft");
  });
});
