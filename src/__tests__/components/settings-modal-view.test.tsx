import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SettingsModalView } from "@/components/settings/settings-modal-view";

const { ResizeObserverMock, resizeObserverCallbacks } = vi.hoisted(() => {
  const callbacks = new Set<() => void>();

  class ResizeObserverMock {
    private readonly callback: () => void;

    constructor(callback: ResizeObserverCallback) {
      this.callback = () => callback([], this as unknown as ResizeObserver);
      callbacks.add(this.callback);
    }

    observe() {}

    disconnect() {
      callbacks.delete(this.callback);
    }

    unobserve() {}
  }

  return {
    ResizeObserverMock,
    resizeObserverCallbacks: callbacks,
  };
});

vi.stubGlobal("ResizeObserver", ResizeObserverMock);

function setScrollMetrics(scrollArea: HTMLElement, clientHeight: number, scrollHeight: number) {
  const viewport = scrollArea.querySelector('[data-slot="scroll-area-viewport"]');

  if (!(viewport instanceof HTMLElement)) {
    throw new Error("Expected scroll area viewport");
  }

  Object.defineProperty(viewport, "clientHeight", {
    configurable: true,
    value: clientHeight,
  });
  Object.defineProperty(viewport, "scrollHeight", {
    configurable: true,
    value: scrollHeight,
  });
}

function notifyResizeObservers() {
  act(() => {
    for (const callback of resizeObserverCallbacks) {
      callback();
    }
  });
}

describe("SettingsModalView", () => {
  it("renders header, navigation slots, and content", () => {
    const onClose = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <SettingsModalView
        open={true}
        title="Preferences"
        closeLabel="Close preferences"
        navigation={<div data-testid="settings-nav">Settings navigation</div>}
        accountsHeading="Accounts"
        accountsNavigation={<div data-testid="accounts-nav">Accounts navigation</div>}
        content={<div>Settings content</div>}
        onClose={onClose}
        onOpenChange={onOpenChange}
      />,
    );

    expect(screen.getByRole("heading", { name: "Preferences" })).toBeInTheDocument();
    expect(screen.getByTestId("settings-nav")).toHaveTextContent("Settings navigation");
    expect(screen.getByTestId("accounts-nav")).toHaveTextContent("Accounts navigation");
    expect(screen.getByText("Settings content")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Close preferences" }));

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("keeps both settings scroll areas constrained to their column height", () => {
    render(
      <SettingsModalView
        open={true}
        title="Preferences"
        closeLabel="Close preferences"
        navigation={<div>Settings navigation</div>}
        accountsHeading="Accounts"
        accountsNavigation={<div>Accounts navigation</div>}
        content={<div>Settings content</div>}
        onClose={vi.fn()}
        onOpenChange={vi.fn()}
      />,
    );

    const scrollAreas = screen.getAllByTestId("settings-scroll-area");

    expect(scrollAreas).toHaveLength(2);
    for (const scrollArea of scrollAreas) {
      expect(scrollArea).toHaveClass("min-h-0");
      expect(scrollArea).toHaveClass("h-full");
    }
  });

  it("adds visual scroll affordances and a taller modal surface", () => {
    render(
      <SettingsModalView
        open={true}
        title="Preferences"
        closeLabel="Close preferences"
        navigation={<div>Settings navigation</div>}
        accountsHeading="Accounts"
        accountsNavigation={<div>Accounts navigation</div>}
        content={<div>Settings content</div>}
        onClose={vi.fn()}
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.getByTestId("settings-modal-surface")).toHaveClass("h-[88vh]");
    expect(screen.getByTestId("settings-modal-surface")).toHaveClass("max-h-[840px]");
    expect(screen.getByTestId("settings-modal-header")).toHaveClass("min-h-16");
    expect(screen.getByTestId("settings-modal-header")).toHaveClass("py-0");
    expect(screen.getByTestId("settings-accounts-section")).toHaveClass("px-3");
    expect(screen.getByTestId("settings-accounts-section")).toHaveClass("py-3");
    expect(screen.getByText("Accounts")).toBeInTheDocument();
  });

  it("hides scrollbars and fades when the panes do not overflow", async () => {
    render(
      <SettingsModalView
        open={true}
        title="Preferences"
        closeLabel="Close preferences"
        navigation={<div>Settings navigation</div>}
        accountsHeading="Accounts"
        accountsNavigation={<div>Accounts navigation</div>}
        content={<div>Settings content</div>}
        onClose={vi.fn()}
        onOpenChange={vi.fn()}
      />,
    );

    const [navScrollArea, contentScrollArea] = screen.getAllByTestId("settings-scroll-area");
    const hiddenScrollbarClass = "[&>[data-slot='scroll-area-scrollbar']]:hidden";

    setScrollMetrics(navScrollArea, 480, 480);
    setScrollMetrics(contentScrollArea, 480, 480);
    notifyResizeObservers();
    fireEvent(window, new Event("resize"));

    await waitFor(() => {
      const [nextNavScrollArea, nextContentScrollArea] = screen.getAllByTestId("settings-scroll-area");
      expect(nextNavScrollArea).toHaveClass(hiddenScrollbarClass);
      expect(nextContentScrollArea).toHaveClass(hiddenScrollbarClass);
    });

    expect(screen.queryByTestId("settings-nav-fade-top")).not.toBeInTheDocument();
    expect(screen.queryByTestId("settings-nav-fade-bottom")).not.toBeInTheDocument();
    expect(screen.queryByTestId("settings-content-fade-top")).not.toBeInTheDocument();
    expect(screen.queryByTestId("settings-content-fade-bottom")).not.toBeInTheDocument();
  });

  it("keeps content scrollbar affordances disabled when the page is marked as non-scrollable", async () => {
    render(
      <SettingsModalView
        open={true}
        title="Preferences"
        closeLabel="Close preferences"
        navigation={<div>Settings navigation</div>}
        accountsHeading="Accounts"
        accountsNavigation={<div>Accounts navigation</div>}
        content={<div>Settings content</div>}
        contentScrollBehavior="never"
        onClose={vi.fn()}
        onOpenChange={vi.fn()}
      />,
    );

    const [, contentScrollArea] = screen.getAllByTestId("settings-scroll-area");
    const hiddenScrollbarClass = "[&>[data-slot='scroll-area-scrollbar']]:hidden";

    setScrollMetrics(contentScrollArea, 480, 720);
    notifyResizeObservers();
    fireEvent(window, new Event("resize"));

    await waitFor(() => {
      expect(screen.getAllByTestId("settings-scroll-area")[1]).toHaveClass(hiddenScrollbarClass);
    });

    expect(screen.queryByTestId("settings-content-fade-top")).not.toBeInTheDocument();
    expect(screen.queryByTestId("settings-content-fade-bottom")).not.toBeInTheDocument();
  });

  it("stacks the navigation above the content on narrow screens", () => {
    render(
      <SettingsModalView
        open={true}
        title="Preferences"
        closeLabel="Close preferences"
        navigation={<div>Settings navigation</div>}
        accountsHeading="Accounts"
        accountsNavigation={<div>Accounts navigation</div>}
        content={<div>Settings content</div>}
        onClose={vi.fn()}
        onOpenChange={vi.fn()}
      />,
    );

    const surface = screen.getByTestId("settings-modal-surface");
    const navPane = surface.firstElementChild as HTMLElement;

    expect(surface).toHaveClass("flex-col");
    expect(surface).toHaveClass("sm:flex-row");
    expect(navPane).toHaveClass("w-full");
    expect(navPane).toHaveClass("sm:w-[260px]");
    expect(navPane).toHaveClass("border-b");
    expect(navPane).toHaveClass("sm:border-r");
  });

  it("does not render dialog content when closed", () => {
    render(
      <SettingsModalView
        open={false}
        title="Preferences"
        closeLabel="Close preferences"
        navigation={<div>Settings navigation</div>}
        accountsHeading="Accounts"
        accountsNavigation={<div>Accounts navigation</div>}
        content={<div>Settings content</div>}
        onClose={vi.fn()}
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders the top loading bar only when isLoading is true", () => {
    const { rerender } = render(
      <SettingsModalView
        open={true}
        title="Preferences"
        closeLabel="Close preferences"
        navigation={<div>Settings navigation</div>}
        accountsHeading="Accounts"
        accountsNavigation={<div>Accounts navigation</div>}
        content={<div>Settings content</div>}
        isLoading={false}
        onClose={vi.fn()}
        onOpenChange={vi.fn()}
      />,
    );

    expect(document.querySelector(".animate-indeterminate")).toBeNull();

    rerender(
      <SettingsModalView
        open={true}
        title="Preferences"
        closeLabel="Close preferences"
        navigation={<div>Settings navigation</div>}
        accountsHeading="Accounts"
        accountsNavigation={<div>Accounts navigation</div>}
        content={<div>Settings content</div>}
        isLoading={true}
        onClose={vi.fn()}
        onOpenChange={vi.fn()}
      />,
    );

    expect(document.querySelector(".animate-indeterminate")).not.toBeNull();
  });
});
