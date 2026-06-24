import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { flushTestResizeObservers } from "@tests/setup";
import type { ReactNode } from "react";
import { describe, expect, expectTypeOf, it, vi } from "vitest";
import { SettingsModalView, type SettingsModalViewProps } from "@/components/settings/settings-modal-view";
import { SettingsContentLayout } from "@/components/settings/shared/settings-content-layout";

function setScrollMetrics(scrollArea: HTMLElement, clientHeight: number, scrollHeight: number) {
  const viewport = getScrollViewport(scrollArea);

  Object.defineProperty(viewport, "clientHeight", {
    configurable: true,
    value: clientHeight,
  });
  Object.defineProperty(viewport, "scrollHeight", {
    configurable: true,
    value: scrollHeight,
  });
}

function getScrollViewport(scrollArea: HTMLElement) {
  const viewport = scrollArea.querySelector('[data-slot="scroll-area-viewport"]');

  if (!(viewport instanceof HTMLElement)) {
    throw new Error("Expected scroll area viewport");
  }

  return viewport;
}

function getFirstElementChild(element: HTMLElement) {
  const child = element.firstElementChild;

  if (!(child instanceof HTMLElement)) {
    throw new Error("Expected first child to be an HTML element");
  }

  return child;
}

function notifyResizeObservers() {
  act(() => {
    flushTestResizeObservers();
  });
}

function settingsContent(children: ReactNode) {
  return <SettingsContentLayout title="General">{children}</SettingsContentLayout>;
}

describe("SettingsModalView", () => {
  it("keeps the settings modal view contract in the feature-local type surface", () => {
    expectTypeOf<SettingsModalViewProps>().toHaveProperty("content").toEqualTypeOf<ReactNode>();
    expectTypeOf<SettingsModalViewProps>().toHaveProperty("navigation").toEqualTypeOf<ReactNode>();
    expectTypeOf<SettingsModalViewProps>().toHaveProperty("onOpenChange").toEqualTypeOf<(open: boolean) => void>();
    expectTypeOf<SettingsModalViewProps>()
      .toHaveProperty("contentScrollBehavior")
      .toEqualTypeOf<"auto" | "always" | "never" | undefined>();
  });

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
        content={settingsContent(<div>Settings content</div>)}
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
    expect(screen.getByTestId("settings-content-motion")).toHaveAttribute("data-motion-phase", "entering");
    expect(screen.getByTestId("settings-content-motion")).toHaveClass("motion-content-swap");
    expect(screen.getByTestId("settings-content-motion")).toHaveClass(
      "flex",
      "min-h-0",
      "flex-1",
      "flex-col",
      "overflow-hidden",
    );

    fireEvent.click(screen.getByRole("button", { name: "Close preferences" }));

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("lets Escape request closing through the dialog top-layer owner", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    render(
      <SettingsModalView
        open={true}
        title="Preferences"
        closeLabel="Close preferences"
        navigation={<button type="button">General</button>}
        accountsHeading="Accounts"
        accountsNavigation={<button type="button">Local account</button>}
        content={settingsContent(<button type="button">Save settings</button>)}
        contentResetKey="general::false"
        onClose={vi.fn()}
        onOpenChange={onOpenChange}
      />,
    );

    screen.getByRole("button", { name: "Save settings" }).focus();
    await user.keyboard("{Escape}");

    expect(onOpenChange).toHaveBeenCalledWith(false, expect.anything());
  });

  it("keeps Tab focus inside the settings modal while a lower command palette layer is inert", async () => {
    const user = userEvent.setup();

    render(
      <>
        <div data-testid="command-palette-layer" data-stack-layer="commandPalette">
          <button type="button">Run command</button>
        </div>
        <SettingsModalView
          open={true}
          title="Preferences"
          closeLabel="Close preferences"
          navigation={<button type="button">General</button>}
          accountsHeading="Accounts"
          accountsNavigation={<button type="button">Local account</button>}
          content={settingsContent(<button type="button">Save settings</button>)}
          contentResetKey="general::false"
          onClose={vi.fn()}
          onOpenChange={vi.fn()}
        />
      </>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("command-palette-layer").closest("[aria-hidden='true']")).toHaveAttribute("inert");
    });

    const dialog = screen.getByRole("dialog", { name: "Preferences" });
    const saveButton = screen.getByRole("button", { name: "Save settings" });
    const lowerLayerButton = screen.getByRole("button", { name: "Run command", hidden: true });

    saveButton.focus();
    expect(saveButton).toHaveFocus();

    await user.tab();

    const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    expect(dialog.contains(activeElement) || activeElement?.hasAttribute("data-base-ui-focus-guard")).toBe(true);
    expect(lowerLayerButton).not.toHaveFocus();
  });

  it("disables closing and shows the lock reason while setup is in progress", () => {
    const onClose = vi.fn();

    render(
      <SettingsModalView
        open={true}
        title="Preferences"
        closeLabel="Close preferences"
        navigation={<div data-testid="settings-nav">Settings navigation</div>}
        accountsHeading="Accounts"
        accountsNavigation={<div data-testid="accounts-nav">Accounts navigation</div>}
        content={settingsContent(<div>Settings content</div>)}
        contentResetKey="general::false"
        isCloseDisabled={true}
        lockMessage="Finish the first sync before closing this screen."
        onClose={onClose}
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Finish the first sync before closing this screen.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close preferences" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Close preferences" }));

    expect(onClose).not.toHaveBeenCalled();
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
        content={settingsContent(<div>Settings content</div>)}
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

  it("uses shared content lanes for settings scroll surfaces", () => {
    render(
      <SettingsModalView
        open={true}
        title="Preferences"
        closeLabel="Close preferences"
        navigation={<div data-testid="settings-nav">Settings navigation</div>}
        accountsHeading="Accounts"
        accountsNavigation={<div>Accounts navigation</div>}
        content={settingsContent(<div data-testid="settings-content">Settings content</div>)}
        contentResetKey="general::false"
        onClose={vi.fn()}
        onOpenChange={vi.fn()}
      />,
    );

    const navLane = screen.getByTestId("settings-nav").closest('[data-slot="scroll-area-content"]');
    const contentLane = screen.getByTestId("settings-content").closest('[data-slot="scroll-area-content"]');

    expect(navLane).toHaveClass("pr-3");
    expect(contentLane).toHaveClass("px-5", "py-6", "sm:px-8", "sm:py-8");
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
        content={settingsContent(<div>Settings content</div>)}
        contentResetKey="general::false"
        onClose={vi.fn()}
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.getByTestId("settings-modal-surface")).toHaveClass("h-[88vh]");
    expect(screen.getByTestId("settings-modal-surface")).toHaveClass("max-h-[860px]");
    expect(screen.getByTestId("settings-modal-surface")).toHaveClass("max-w-[980px]");
    expect(screen.getByTestId("settings-modal-surface")).toHaveClass("bg-popover");
    expect(screen.getByTestId("settings-modal-surface")).toHaveClass("rounded-xl");
    expect(screen.getByTestId("settings-modal-surface")).toHaveClass("shadow-[var(--settings-shell-shadow)]");
    expect(screen.getByTestId("settings-nav-shell")).not.toHaveClass("rounded-xl");
    expect(screen.getByTestId("settings-content-shell")).not.toHaveClass("rounded-xl");
    expect(screen.getByTestId("settings-modal-header")).toHaveClass("min-h-[5rem]");
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
    expect(screen.getByTestId("settings-nav-shell")).toHaveClass("max-h-[18rem]");
    expect(screen.getByTestId("settings-nav-shell")).toHaveClass("sm:h-auto");
    expect(screen.getByTestId("settings-accounts-section")).toHaveClass("p-3");
    expect(screen.getByTestId("settings-accounts-section")).toHaveClass("rounded-md");
    expect(screen.getByTestId("settings-accounts-section")).toHaveClass(
      "border-[var(--settings-shell-section-border)]",
    );
    expect(screen.getByTestId("settings-accounts-section")).toHaveClass("shadow-none");
    expect(screen.getByTestId("settings-accounts-section")).toHaveStyle({
      backgroundColor: "var(--settings-shell-account-surface)",
    });
    expect(screen.getByTestId("settings-accounts-scroll-area")).toHaveClass("max-h-[15rem]");
    expect(screen.getByTestId("settings-accounts-scroll-area")).toHaveClass("min-h-0");
    expect(
      screen.getByTestId("settings-accounts-section").querySelector('[data-slot="scroll-area-content"]'),
    ).toHaveClass("pr-2");
    expect(screen.getAllByText("Accounts")).toHaveLength(2);
    expect(screen.getAllByText("Accounts")[0]).toHaveClass("text-[color:var(--settings-shell-section-label)]");
    expect(screen.getAllByText("Accounts")[0]).toHaveClass("select-none");
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
        content={settingsContent(<div>Settings content</div>)}
        contentResetKey="general::false"
        onClose={vi.fn()}
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.getByTestId("settings-mobile-accounts-section")).toBeInTheDocument();
    expect(screen.getByTestId("settings-mobile-accounts-section")).toHaveClass("rounded-md");
    expect(screen.getByTestId("settings-mobile-accounts-section")).toHaveClass(
      "border-[var(--settings-shell-section-border)]",
    );
    expect(screen.getByTestId("settings-mobile-accounts-section")).toHaveClass("shadow-none");
    expect(screen.getByTestId("settings-mobile-accounts-scroll-area")).toHaveClass("max-h-[4.75rem]");
    expect(screen.getAllByText("Accounts navigation")[0].closest('[data-slot="scroll-area-content"]')).toHaveClass(
      "px-3",
      "py-1.5",
      "pr-5",
    );
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
        content={settingsContent(<div>Settings content</div>)}
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

  it("shows a trailing content scrollbar affordance when the content overflows", async () => {
    render(
      <SettingsModalView
        open={true}
        title="Preferences"
        closeLabel="Close preferences"
        navigation={<div>Settings navigation</div>}
        accountsHeading="Accounts"
        accountsNavigation={<div>Accounts navigation</div>}
        content={settingsContent(<div>Settings content</div>)}
        contentScrollBehavior="always"
        contentResetKey="general::false"
        onClose={vi.fn()}
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.getByTestId("settings-content-scroll-area")).not.toHaveClass(
      "[&>[data-slot='scroll-area-scrollbar']]:hidden",
    );

    expect(screen.queryByTestId("settings-content-fade-top")).not.toBeInTheDocument();
    expect(screen.getByTestId("settings-content-fade-bottom")).toBeInTheDocument();
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
        content={settingsContent(<div>Settings content</div>)}
        contentResetKey="general::false"
        onClose={vi.fn()}
        onOpenChange={vi.fn()}
      />,
    );

    const surface = screen.getByTestId("settings-modal-surface");
    const navPane = getFirstElementChild(surface);
    expect(surface).toHaveClass("flex-col");
    expect(surface).toHaveClass("sm:flex-row");
    expect(navPane).toHaveClass("w-full");
    expect(navPane).toHaveClass("max-h-[18rem]");
    expect(navPane).not.toHaveClass("h-[18rem]");
    expect(navPane).toHaveClass("sm:h-auto");
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
        content={settingsContent(<div>Settings content</div>)}
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
        content={settingsContent(<div>Settings content</div>)}
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
        content={settingsContent(<div>Settings content</div>)}
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
        content={settingsContent(<div style={{ height: 1200 }}>Settings content</div>)}
        contentResetKey="accounts:acc-1:false"
        onClose={vi.fn()}
        onOpenChange={vi.fn()}
      />,
    );

    const initialContentViewport = getScrollViewport(screen.getByTestId("settings-content-scroll-area"));
    const accountsScrollArea = screen.getByTestId("settings-accounts-scroll-area");
    const accountsViewport = getScrollViewport(accountsScrollArea);

    initialContentViewport.scrollTop = 180;
    accountsViewport.scrollTop = 90;

    rerender(
      <SettingsModalView
        open={true}
        title="Preferences"
        closeLabel="Close preferences"
        navigation={<div>Settings navigation</div>}
        accountsHeading="Accounts"
        accountsNavigation={<div>Accounts navigation</div>}
        content={settingsContent(<div style={{ height: 1200 }}>Other settings content</div>)}
        contentResetKey="accounts:acc-2:false"
        onClose={vi.fn()}
        onOpenChange={vi.fn()}
      />,
    );

    const nextContentViewport = getScrollViewport(screen.getByTestId("settings-content-scroll-area"));

    expect(nextContentViewport.scrollTop).toBe(0);
    expect(accountsViewport.scrollTop).toBe(90);
  });
});
