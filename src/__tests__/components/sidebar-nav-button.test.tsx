import { act, render, screen } from "@testing-library/react";
import { createModernMatchMedia } from "@tests/helpers/match-media";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SidebarNavButton } from "@/components/reader/sidebar-nav-button";
import { MOTION_SIDEBAR_BADGE_EXIT_DURATION_MS } from "@/constants";

function queryTrailingBadge(container: HTMLElement) {
  return container.querySelector(".motion-sidebar-badge");
}

function stubReducedMotion(matches: boolean) {
  const reducedMotionQuery = createModernMatchMedia(matches, "(prefers-reduced-motion: reduce)");
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) =>
      query === "(prefers-reduced-motion: reduce)" ? reducedMotionQuery : createModernMatchMedia(false, query),
  });
  return reducedMotionQuery;
}

describe("SidebarNavButton", () => {
  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(window, "matchMedia", { configurable: true, writable: true, value: undefined });
  });

  it("keeps the selected indicator visible by default", () => {
    const { container } = render(<SidebarNavButton selected>Selected feed</SidebarNavButton>);

    const button = screen.getByRole("button", { name: "Selected feed" });
    const content = container.querySelector("button > span");

    expect(button).toHaveClass("motion-contextual-surface");
    expect(button).toHaveClass("select-none");
    expect(button).not.toHaveClass("focus-visible:ring-2");
    expect(button).not.toHaveClass("focus-visible:outline-[var(--color-ring)]");
    expect(button).toHaveClass("bg-[image:var(--sidebar-selection-gradient)]");
    expect(button).toHaveClass("before:bg-primary/85");
    expect(button).not.toHaveClass("shadow-[var(--sidebar-selection-shadow)]");
    expect(button).not.toHaveClass("group-hover/feed-row:before:opacity-0");
    expect(button).not.toHaveClass("group-focus-within/feed-row:before:opacity-0");
    expect(content).toHaveClass("flex-1");
    expect(content).toHaveClass("justify-start");
  });

  it("keeps the selection fill distinct from hover when its pane is inactive", () => {
    render(
      <SidebarNavButton selected activePane={false}>
        Selected feed
      </SidebarNavButton>,
    );

    const button = screen.getByRole("button", { name: "Selected feed" });
    expect(button).toHaveAttribute("data-active-pane", "false");
    expect(button).toHaveClass("bg-[image:var(--sidebar-selection-gradient)]");
    expect(button).not.toHaveClass("bg-[image:var(--sidebar-hover-gradient)]");
    expect(button).not.toHaveClass("shadow-[var(--sidebar-selection-shadow)]");
  });

  it("can use a neutral selected indicator for non-feed navigation", () => {
    render(
      <SidebarNavButton selected selectedIndicatorTone="neutral">
        Selected account
      </SidebarNavButton>,
    );

    const button = screen.getByRole("button", { name: "Selected account" });
    expect(button).toHaveClass("before:bg-border-strong/70", "before:opacity-70");
    expect(button).not.toHaveClass("before:bg-primary/85");
  });

  it("can opt out of sidebar arrow navigation target registration", () => {
    render(<SidebarNavButton registerSidebarNavigationTarget={false}>Account pane row</SidebarNavButton>);

    expect(screen.getByRole("button", { name: "Account pane row" })).not.toHaveAttribute(
      "data-sidebar-navigation-target",
    );
  });

  it("can hide the selected indicator while the row is hovered or focused", () => {
    render(
      <SidebarNavButton selected selectedIndicatorMode="hide-on-row-hover">
        Selected feed
      </SidebarNavButton>,
    );

    const button = screen.getByRole("button", { name: "Selected feed" });

    expect(button).toHaveClass("before:bg-primary/85");
    expect(button).toHaveClass("group-hover/feed-row:before:opacity-0");
    expect(button).toHaveClass("group-focus-within/feed-row:before:opacity-0");
  });

  it("can omit the built-in selected indicator when the row renders its own indicator", () => {
    render(
      <SidebarNavButton selected selectedIndicatorMode="hidden">
        Selected feed
      </SidebarNavButton>,
    );

    const button = screen.getByRole("button", { name: "Selected feed" });

    expect(button).not.toHaveClass("before:bg-primary/85");
    expect(button).not.toHaveClass("group-hover/feed-row:before:opacity-0");
  });

  it("uses the softened hover surface for unselected rows", () => {
    render(<SidebarNavButton>Feed row</SidebarNavButton>);

    expect(screen.getByRole("button", { name: "Feed row" })).toHaveClass(
      "motion-contextual-surface",
      "select-none",
      "hover:bg-[var(--sidebar-hover-surface)]",
      "focus-visible:bg-[image:var(--sidebar-focus-gradient)]",
    );
  });

  it("uses content-swap treatment for trailing counts", () => {
    render(<SidebarNavButton trailing={12}>Feed row</SidebarNavButton>);

    expect(screen.getByText("12")).toHaveClass("motion-content-swap", "tabular-nums");
    expect(screen.getByText("12")).toHaveClass("w-8", "justify-end", "text-right");
    expect(screen.getByText("12")).toHaveAttribute("data-motion-phase", "entering");
  });

  it("removes the trailing badge immediately when trailing clears without opting in", () => {
    const { container, rerender } = render(<SidebarNavButton trailing={1}>Feed row</SidebarNavButton>);

    expect(screen.getByText("1")).toBeInTheDocument();

    rerender(<SidebarNavButton trailing={undefined}>Feed row</SidebarNavButton>);

    expect(screen.queryByText("1")).not.toBeInTheDocument();
    expect(queryTrailingBadge(container)).toBeNull();
  });

  it("keeps rendering the last trailing value in a leaving state when opted in, instead of unmounting it", () => {
    const { container, rerender } = render(
      <SidebarNavButton trailing={1} trailingKeepLastOnClear>
        Feed row
      </SidebarNavButton>,
    );

    expect(screen.getByText("1")).toBeInTheDocument();
    expect(queryTrailingBadge(container)).not.toHaveAttribute("data-motion-sidebar-badge-leaving");

    rerender(
      <SidebarNavButton trailing={undefined} trailingKeepLastOnClear>
        Feed row
      </SidebarNavButton>,
    );

    const badge = queryTrailingBadge(container);
    expect(badge).not.toBeNull();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(badge).toHaveAttribute("data-motion-sidebar-badge-leaving", "true");
  });

  it("hides the leaving badge from the accessibility tree so it does not read as the current count", () => {
    const { container, rerender } = render(
      <SidebarNavButton trailing={1} trailingKeepLastOnClear>
        Feed row
      </SidebarNavButton>,
    );

    rerender(
      <SidebarNavButton trailing={undefined} trailingKeepLastOnClear>
        Feed row
      </SidebarNavButton>,
    );

    expect(queryTrailingBadge(container)).toHaveAttribute("aria-hidden", "true");
  });

  it("clears the leaving state without leaving a stale duplicate once trailing returns", () => {
    const { container, rerender } = render(
      <SidebarNavButton trailing={1} trailingKeepLastOnClear>
        Feed row
      </SidebarNavButton>,
    );

    rerender(
      <SidebarNavButton trailing={undefined} trailingKeepLastOnClear>
        Feed row
      </SidebarNavButton>,
    );
    expect(queryTrailingBadge(container)).toHaveAttribute("data-motion-sidebar-badge-leaving", "true");

    rerender(
      <SidebarNavButton trailing={2} trailingKeepLastOnClear>
        Feed row
      </SidebarNavButton>,
    );

    const badge = queryTrailingBadge(container);
    expect(container.querySelectorAll(".motion-sidebar-badge")).toHaveLength(1);
    expect(badge).not.toHaveAttribute("data-motion-sidebar-badge-leaving");
    expect(badge).not.toHaveAttribute("aria-hidden");
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.queryByText("1")).not.toBeInTheDocument();
  });

  it("unmounts the leaving badge once the fade duration elapses, restoring the pre-change layout", () => {
    vi.useFakeTimers();
    const { container, rerender } = render(
      <SidebarNavButton trailing={1} trailingKeepLastOnClear>
        Feed row
      </SidebarNavButton>,
    );

    rerender(
      <SidebarNavButton trailing={undefined} trailingKeepLastOnClear>
        Feed row
      </SidebarNavButton>,
    );
    expect(queryTrailingBadge(container)).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(MOTION_SIDEBAR_BADGE_EXIT_DURATION_MS);
    });

    expect(queryTrailingBadge(container)).toBeNull();
    expect(screen.queryByText("1")).not.toBeInTheDocument();
  });

  it("cancels the pending leave timer and shows the new value immediately when trailing returns before the fade finishes", () => {
    vi.useFakeTimers();
    const { container, rerender } = render(
      <SidebarNavButton trailing={1} trailingKeepLastOnClear>
        Feed row
      </SidebarNavButton>,
    );

    rerender(
      <SidebarNavButton trailing={undefined} trailingKeepLastOnClear>
        Feed row
      </SidebarNavButton>,
    );

    act(() => {
      vi.advanceTimersByTime(MOTION_SIDEBAR_BADGE_EXIT_DURATION_MS / 2);
    });

    rerender(
      <SidebarNavButton trailing={2} trailingKeepLastOnClear>
        Feed row
      </SidebarNavButton>,
    );

    // Advance well past the cancelled timer's original deadline: it must not fire.
    act(() => {
      vi.advanceTimersByTime(MOTION_SIDEBAR_BADGE_EXIT_DURATION_MS * 2);
    });

    const badge = queryTrailingBadge(container);
    expect(badge).not.toBeNull();
    expect(badge).not.toHaveAttribute("data-motion-sidebar-badge-leaving");
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.queryByText("1")).not.toBeInTheDocument();
  });

  it("does not let a stale leave timer from an earlier clear remove a newer leaving badge (1 -> 0 -> 2 -> 0)", () => {
    vi.useFakeTimers();
    const { container, rerender } = render(
      <SidebarNavButton trailing={1} trailingKeepLastOnClear>
        Feed row
      </SidebarNavButton>,
    );

    // First clear starts a leave timer for "1".
    rerender(
      <SidebarNavButton trailing={undefined} trailingKeepLastOnClear>
        Feed row
      </SidebarNavButton>,
    );
    act(() => {
      vi.advanceTimersByTime(MOTION_SIDEBAR_BADGE_EXIT_DURATION_MS / 2);
    });

    // Revives with a different value before that timer fires, cancelling it.
    rerender(
      <SidebarNavButton trailing={2} trailingKeepLastOnClear>
        Feed row
      </SidebarNavButton>,
    );

    // Second clear starts a fresh leave timer for "2".
    rerender(
      <SidebarNavButton trailing={undefined} trailingKeepLastOnClear>
        Feed row
      </SidebarNavButton>,
    );

    // The stale first timer's original deadline falls inside this window; it must not fire here.
    act(() => {
      vi.advanceTimersByTime(MOTION_SIDEBAR_BADGE_EXIT_DURATION_MS / 2);
    });

    let badge = queryTrailingBadge(container);
    expect(badge).not.toBeNull();
    expect(badge).toHaveAttribute("data-motion-sidebar-badge-leaving", "true");
    expect(screen.getByText("2")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(MOTION_SIDEBAR_BADGE_EXIT_DURATION_MS / 2);
    });

    badge = queryTrailingBadge(container);
    expect(badge).toBeNull();
  });

  it("unmounts the leaving badge immediately, without waiting, when the viewer prefers reduced motion", () => {
    stubReducedMotion(true);

    const { container, rerender } = render(
      <SidebarNavButton trailing={1} trailingKeepLastOnClear>
        Feed row
      </SidebarNavButton>,
    );

    rerender(
      <SidebarNavButton trailing={undefined} trailingKeepLastOnClear>
        Feed row
      </SidebarNavButton>,
    );

    expect(queryTrailingBadge(container)).toBeNull();
    expect(screen.queryByText("1")).not.toBeInTheDocument();
  });

  it("unmounts the leaving badge as soon as reduced motion turns on mid-fade, without waiting for the timer", () => {
    vi.useFakeTimers();
    const reducedMotionQuery = stubReducedMotion(false);

    const { container, rerender } = render(
      <SidebarNavButton trailing={1} trailingKeepLastOnClear>
        Feed row
      </SidebarNavButton>,
    );

    rerender(
      <SidebarNavButton trailing={undefined} trailingKeepLastOnClear>
        Feed row
      </SidebarNavButton>,
    );
    expect(queryTrailingBadge(container)).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(MOTION_SIDEBAR_BADGE_EXIT_DURATION_MS / 2);
    });
    expect(queryTrailingBadge(container)).not.toBeNull();

    act(() => {
      reducedMotionQuery.dispatch(true);
    });

    expect(queryTrailingBadge(container)).toBeNull();
    expect(screen.queryByText("1")).not.toBeInTheDocument();

    // The now-cancelled timer must not fire later and touch already-cleared state.
    act(() => {
      vi.advanceTimersByTime(MOTION_SIDEBAR_BADGE_EXIT_DURATION_MS);
    });
    expect(queryTrailingBadge(container)).toBeNull();
  });

  it("unsubscribes the reduced-motion listener once the badge is no longer leaving", () => {
    const reducedMotionQuery = stubReducedMotion(false);

    const { rerender, unmount } = render(
      <SidebarNavButton trailing={1} trailingKeepLastOnClear>
        Feed row
      </SidebarNavButton>,
    );

    rerender(
      <SidebarNavButton trailing={undefined} trailingKeepLastOnClear>
        Feed row
      </SidebarNavButton>,
    );
    expect(reducedMotionQuery.listenerCount()).toBe(1);

    unmount();

    expect(reducedMotionQuery.listenerCount()).toBe(0);
  });

  it("unsubscribes the reduced-motion listener once the leave timer finishes on its own", () => {
    vi.useFakeTimers();
    const reducedMotionQuery = stubReducedMotion(false);

    const { rerender } = render(
      <SidebarNavButton trailing={1} trailingKeepLastOnClear>
        Feed row
      </SidebarNavButton>,
    );

    rerender(
      <SidebarNavButton trailing={undefined} trailingKeepLastOnClear>
        Feed row
      </SidebarNavButton>,
    );
    expect(reducedMotionQuery.listenerCount()).toBe(1);

    act(() => {
      vi.advanceTimersByTime(MOTION_SIDEBAR_BADGE_EXIT_DURATION_MS);
    });

    expect(reducedMotionQuery.listenerCount()).toBe(0);
  });

  it("keeps its public ref contract attached to the native button", () => {
    const buttonRef = createRef<HTMLButtonElement>();

    render(<SidebarNavButton ref={buttonRef}>Feed row</SidebarNavButton>);

    expect(buttonRef.current).toBe(screen.getByRole("button", { name: "Feed row" }));
  });
});
