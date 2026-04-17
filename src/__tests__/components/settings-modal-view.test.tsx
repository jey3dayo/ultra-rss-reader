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
        contentResetKey="general::false"
        onClose={onClose}
        onOpenChange={onOpenChange}
      />,
    );

    expect(screen.getByRole("heading", { name: "Preferences" })).toBeInTheDocument();
    expect(screen.getByTestId("settings-nav")).toHaveTextContent("Settings navigation");
    expect(screen.getAllByTestId("accounts-nav")).toHaveLength(2);
    expect(screen.getAllByTestId("accounts-nav")[0]).toHaveTextContent("Accounts navigation");
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
        contentResetKey="general::false"
        onClose={vi.fn()}
        onOpenChange={vi.fn()}
      />,
    );

    const navScrollArea = screen.getByTestId("settings-nav-scroll-area");
    const contentScrollArea = screen.getByTestId("settings-content-scroll-area");

    expect(navScrollArea).toHaveClass("min-h-0");
    expect(navScrollArea).toHaveClass("h-full");
    expect(contentScrollArea).toHaveClass("min-h-0");
    expect(contentScrollArea).toHaveClass("h-full");
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
        contentResetKey="general::false"
        onClose={vi.fn()}
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.getByTestId("settings-modal-surface")).toHaveClass("h-[88vh]");
    expect(screen.getByTestId("settings-modal-surface")).toHaveClass("max-h-[860px]");
    expect(screen.getByTestId("settings-modal-surface")).toHaveClass("max-w-[980px]");
    expect(screen.getByTestId("settings-modal-surface")).toHaveClass("bg-popover");
    expect(screen.getByTestId("settings-modal-surface")).toHaveClass("rounded-2xl");
    expect(screen.getByTestId("settings-modal-surface")).toHaveClass("shadow-elevation-3");
    expect(screen.getByTestId("settings-nav-shell")).not.toHaveClass("rounded-xl");
    expect(screen.getByTestId("settings-content-shell")).not.toHaveClass("rounded-xl");
    expect(screen.getByTestId("settings-modal-header")).toHaveClass("min-h-[4.5rem]");
    expect(screen.getByTestId("settings-modal-header")).toHaveClass("py-0");
    expect(screen.getByTestId("settings-modal-header")).toHaveStyle({
      backgroundColor: "var(--settings-shell-rail)",
    });
    expect(screen.getByRole("button", { name: "Close preferences" })).toHaveClass("text-sidebar-foreground/40");
    expect(screen.getByRole("button", { name: "Close preferences" })).toHaveClass(
      "hover:bg-[var(--sidebar-hover-surface)]",
    );
    expect(screen.getByTestId("settings-nav-shell")).toHaveStyle({
      backgroundColor: "var(--settings-shell-rail)",
    });
    expect(screen.getByTestId("settings-accounts-section")).toHaveClass("px-3");
    expect(screen.getByTestId("settings-accounts-section")).toHaveClass("py-3");
    expect(screen.getByTestId("settings-accounts-section")).toHaveClass("rounded-md");
    expect(screen.getByTestId("settings-accounts-section")).toHaveClass("border-border/60");
    expect(screen.getByTestId("settings-accounts-section")).toHaveClass("shadow-none");
    expect(screen.getByTestId("settings-accounts-section")).toHaveStyle({
      backgroundColor: "var(--settings-shell-account-surface)",
    });
    expect(screen.getByTestId("settings-accounts-scroll-area")).toHaveClass("max-h-[15rem]");
    expect(screen.getByTestId("settings-accounts-scroll-area")).toHaveClass("min-h-0");
    expect(screen.getAllByText("Accounts")).toHaveLength(2);
    expect(screen.getAllByText("Accounts")[0]).toHaveClass("text-[color:var(--settings-shell-section-label)]");
  });

  it("renders a narrow-screen accounts section inside the navigation flow", () => {
    render(
      <SettingsModalView
        open={true}
        title="Preferences"
        closeLabel="Close preferences"
        navigation={<div>Settings navigation</div>}
        accountsHeading="Accounts"
        accountsNavigation={<div>Accounts navigation</div>}
        content={<div>Settings content</div>}
        contentResetKey="general::false"
        onClose={vi.fn()}
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.getByTestId("settings-mobile-accounts-section")).toBeInTheDocument();
    expect(screen.getByTestId("settings-mobile-accounts-section")).toHaveClass("rounded-md");
    expect(screen.getByTestId("settings-mobile-accounts-section")).toHaveClass("max-h-[5.5rem]");
    expect(screen.getByTestId("settings-mobile-accounts-section")).toHaveClass("overflow-y-auto");
    expect(screen.getByTestId("settings-mobile-accounts-section")).toHaveClass("border-border/60");
    expect(screen.getByTestId("settings-mobile-accounts-section")).toHaveClass("shadow-none");
    expect(screen.getByTestId("settings-mobile-accounts-section")).toHaveStyle({
      backgroundColor: "var(--settings-shell-account-surface)",
    });
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
        contentResetKey="general::false"
        onClose={vi.fn()}
        onOpenChange={vi.fn()}
      />,
    );

    const hiddenScrollbarClass = "[&>[data-slot='scroll-area-scrollbar']]:hidden";
    const navScrollArea = screen.getByTestId("settings-nav-scroll-area");
    const contentScrollArea = screen.getByTestId("settings-content-scroll-area");

    setScrollMetrics(navScrollArea, 480, 480);
    setScrollMetrics(contentScrollArea, 480, 480);
    notifyResizeObservers();
    fireEvent(window, new Event("resize"));

    await waitFor(() => {
      expect(screen.getByTestId("settings-nav-scroll-area")).toHaveClass(hiddenScrollbarClass);
      expect(screen.getByTestId("settings-content-scroll-area")).toHaveClass(hiddenScrollbarClass);
    });

    expect(screen.queryByTestId("settings-nav-fade-top")).not.toBeInTheDocument();
    expect(screen.queryByTestId("settings-nav-fade-bottom")).not.toBeInTheDocument();
    expect(screen.queryByTestId("settings-content-fade-top")).not.toBeInTheDocument();
    expect(screen.queryByTestId("settings-content-fade-bottom")).not.toBeInTheDocument();
  });

  it("shows content scrollbar affordances when the content overflows", async () => {
    render(
      <SettingsModalView
        open={true}
        title="Preferences"
        closeLabel="Close preferences"
        navigation={<div>Settings navigation</div>}
        accountsHeading="Accounts"
        accountsNavigation={<div>Accounts navigation</div>}
        content={<div>Settings content</div>}
        contentScrollBehavior="always"
        contentResetKey="general::false"
        onClose={vi.fn()}
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.getByTestId("settings-content-scroll-area")).not.toHaveClass(
      "[&>[data-slot='scroll-area-scrollbar']]:hidden",
    );

    expect(screen.getByTestId("settings-content-fade-top")).toBeInTheDocument();
    expect(screen.getByTestId("settings-content-fade-bottom")).toBeInTheDocument();
    expect(screen.getByTestId("settings-content-fade-top")).toHaveStyle({
      backgroundImage: "var(--settings-shell-content-fade)",
    });
    expect(screen.getByTestId("settings-content-fade-bottom")).toHaveStyle({
      backgroundImage: "var(--settings-shell-content-fade-reverse)",
    });
    expect(screen.getByTestId("settings-content-shell")).toHaveStyle({
      backgroundColor: "var(--settings-shell-content)",
    });
    expect(document.querySelector('[data-slot="dialog-overlay"]')).toHaveClass(
      "bg-dialog-overlay-readable",
      "bg-dialog-scrim-readable",
    );
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
        contentResetKey="general::false"
        onClose={vi.fn()}
        onOpenChange={vi.fn()}
      />,
    );

    const surface = screen.getByTestId("settings-modal-surface");
    const navPane = surface.firstElementChild as HTMLElement;
    expect(surface).toHaveClass("flex-col");
    expect(surface).toHaveClass("sm:flex-row");
    expect(navPane).toHaveClass("w-full");
    expect(navPane).toHaveClass("max-h-[15rem]");
    expect(navPane).toHaveClass("sm:w-[292px]");
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
        contentResetKey="general::false"
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
        contentResetKey="general::false"
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
        contentResetKey="general::false"
        onClose={vi.fn()}
        onOpenChange={vi.fn()}
      />,
    );

    expect(document.querySelector(".animate-indeterminate")).not.toBeNull();
  });

  it("resets only the content viewport scroll position when the content key changes", () => {
    const { rerender } = render(
      <SettingsModalView
        open={true}
        title="Preferences"
        closeLabel="Close preferences"
        navigation={<div>Settings navigation</div>}
        accountsHeading="Accounts"
        accountsNavigation={<div>Accounts navigation</div>}
        content={<div style={{ height: 1200 }}>Settings content</div>}
        contentResetKey="accounts:acc-1:false"
        onClose={vi.fn()}
        onOpenChange={vi.fn()}
      />,
    );

    const initialContentViewport = screen
      .getByTestId("settings-content-scroll-area")
      .querySelector('[data-slot="scroll-area-viewport"]') as HTMLElement;
    const accountsScrollArea = screen.getByTestId("settings-accounts-scroll-area");

    initialContentViewport.scrollTop = 180;
    accountsScrollArea.scrollTop = 90;

    rerender(
      <SettingsModalView
        open={true}
        title="Preferences"
        closeLabel="Close preferences"
        navigation={<div>Settings navigation</div>}
        accountsHeading="Accounts"
        accountsNavigation={<div>Accounts navigation</div>}
        content={<div style={{ height: 1200 }}>Other settings content</div>}
        contentResetKey="accounts:acc-2:false"
        onClose={vi.fn()}
        onOpenChange={vi.fn()}
      />,
    );

    const nextContentViewport = screen
      .getByTestId("settings-content-scroll-area")
      .querySelector('[data-slot="scroll-area-viewport"]') as HTMLElement;

    expect(nextContentViewport.scrollTop).toBe(0);
    expect(accountsScrollArea.scrollTop).toBe(90);
  });
});
