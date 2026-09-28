import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppLayoutLazyPaneFallback, type AppLayoutLazyPaneKind } from "@/components/app-layout-lazy-pane-fallback";

const PANE_SHELL_TEST_IDS: ReadonlyArray<[AppLayoutLazyPaneKind, string]> = [
  ["sidebar", "app-layout-sidebar-shell-skeleton"],
  ["list", "article-list-skeleton"],
  ["content", "app-layout-article-view-shell-skeleton"],
  ["account", "app-layout-account-pane-shell-skeleton"],
];

describe("AppLayoutLazyPaneFallback", () => {
  it.each(PANE_SHELL_TEST_IDS)("renders the %s pane shell while lazy content is pending", (pane, testId) => {
    render(<AppLayoutLazyPaneFallback pane={pane} />);

    expect(screen.getByTestId(testId)).toBeInTheDocument();
  });

  it("exposes one loading status for the sidebar shell", () => {
    render(<AppLayoutLazyPaneFallback pane="sidebar" />);

    expect(screen.getByTestId("app-layout-sidebar-shell-skeleton")).toHaveAttribute("role", "status");
    expect(screen.getByText("Loading…")).toHaveClass("sr-only");
  });

  it("shows the account pane heading from sidebar copy", () => {
    render(<AppLayoutLazyPaneFallback pane="account" />);

    expect(screen.getByText("Accounts")).toBeInTheDocument();
  });
});
