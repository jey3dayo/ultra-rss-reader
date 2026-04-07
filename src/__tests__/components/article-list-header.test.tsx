import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { ArticleListHeader } from "@/components/reader/article-list-header";
import { createWrapper } from "../../../tests/helpers/create-wrapper";

describe("ArticleListHeader", () => {
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

    expect(screen.getByRole("button", { name: "Show sidebar" })).toHaveTextContent("Subscriptions");
  });
});
