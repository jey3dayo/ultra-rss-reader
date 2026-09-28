import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppLayoutLazyPaneFallback } from "@/components/app-layout-lazy-pane-fallback";

describe("AppLayoutLazyPaneFallback", () => {
  it("renders sidebar shell skeleton with a single loading status", () => {
    render(<AppLayoutLazyPaneFallback pane="sidebar" />);

    expect(screen.getByTestId("app-layout-sidebar-shell-skeleton")).toHaveAttribute("role", "status");
    expect(screen.getByText("Loading…")).toHaveClass("sr-only");
  });

  it("renders article list skeleton for the list pane", () => {
    render(<AppLayoutLazyPaneFallback pane="list" />);

    expect(screen.getByTestId("article-list-skeleton")).toBeInTheDocument();
  });

  it("renders article view shell skeleton for the content pane", () => {
    render(<AppLayoutLazyPaneFallback pane="content" />);

    expect(screen.getByTestId("app-layout-article-view-shell-skeleton")).toBeInTheDocument();
  });

  it("renders account pane shell skeleton with accounts heading", () => {
    render(<AppLayoutLazyPaneFallback pane="account" />);

    expect(screen.getByTestId("app-layout-account-pane-shell-skeleton")).toBeInTheDocument();
    expect(screen.getByText("Accounts")).toBeInTheDocument();
  });
});
