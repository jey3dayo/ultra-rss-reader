import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BrowserOverlayChrome } from "@/components/reader/browser-overlay-chrome";
import type {
  BrowserOverlayChromeController,
  BrowserOverlayToolbarAction,
  BrowserViewSurfacePresentation,
} from "@/components/reader/browser-view.types";

function createController(overrides?: Partial<BrowserOverlayChromeController>): BrowserOverlayChromeController {
  return {
    browserState: {
      url: "https://example.com/article",
      can_go_back: false,
      can_go_forward: false,
      is_loading: false,
    },
    geometry: {
      compact: false,
      ultraCompact: false,
      chromeRail: {
        visible: true,
        left: 0,
        right: 0,
        top: 0,
        height: 56,
      },
      stage: {
        left: 0,
        top: 56,
        right: 0,
        bottom: 0,
      },
      host: {
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
      },
      chrome: {
        visualHeaderHeight: 56,
        leadingSafeInset: 72,
        leading: {
          left: 72,
          top: 12,
        },
        action: {
          right: 16,
          top: 12,
          size: 44,
        },
      },
      diagnostics: {
        compact: false,
        top: 64,
      },
    },
    handleCloseOverlay: vi.fn(),
    handleGoBack: vi.fn(async () => {}),
    handleGoForward: vi.fn(async () => {}),
    handleReload: vi.fn(async () => {}),
    handleOpenExternal: vi.fn(async () => {}),
    ...overrides,
  };
}

function createSurfacePresentation(
  overrides?: Partial<BrowserViewSurfacePresentation>,
): BrowserViewSurfacePresentation {
  return {
    leadingActionSurface: {
      compact: true,
      tone: "default",
    },
    actionButtonSurface: {
      compact: true,
      tone: "default",
    },
    stageSurface: {
      scope: "main-stage",
    },
    ...overrides,
  };
}

const shareToolbarActions: BrowserOverlayToolbarAction[] = [
  {
    key: "share",
    label: "Share",
    onClick: vi.fn(),
    icon: <span aria-hidden="true">S</span>,
  },
];

describe("BrowserOverlayChrome", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders only the close action for the image-viewer overlay chrome", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<BrowserOverlayChrome closeLabel="Close browser overlay" onClose={onClose} />);

    expect(screen.getAllByRole("button")).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Close browser overlay" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("keeps the close control as a chrome shell affordance with keyboard-visible focus and tactile active feedback", () => {
    render(<BrowserOverlayChrome closeLabel="Close browser overlay" onClose={() => {}} />);

    const closeButton = screen.getByRole("button", {
      name: "Close browser overlay",
    });
    const closeSurface = closeButton.closest("[data-overlay-shell='action']");

    expect(closeSurface).not.toBeNull();
    expect(closeSurface).toHaveAttribute("data-overlay-shell", "action");
    expect(closeSurface).toHaveClass("rounded-lg");
    expect(closeSurface).toHaveClass("bg-transparent");
    expect(closeSurface).toHaveClass("text-foreground-soft");
    expect(closeSurface).toHaveClass("shadow-none");
    expect(closeSurface).toHaveClass("hover:bg-transparent");
    expect(closeSurface).toHaveClass("has-[:focus-visible]:bg-transparent");
    expect(closeSurface).toHaveClass("has-[:focus-visible]:ring-0");
    expect(closeSurface).toHaveClass("has-[:active]:bg-overlay-action-surface-chrome-active");
    expect(closeSurface).not.toHaveClass("border");
    expect(closeSurface).not.toHaveClass("border-transparent");
  });

  it("renders close, back, and forward controls on the leading side", async () => {
    const user = userEvent.setup();
    const controller = createController({
      browserState: {
        url: "https://example.com/article",
        can_go_back: true,
        can_go_forward: false,
        is_loading: false,
      },
    });
    const presentation = createSurfacePresentation();

    render(
      <BrowserOverlayChrome
        controller={controller}
        presentation={presentation}
        closeWebPreviewLabel="Close Web Preview"
      />,
    );

    const leadingChrome = within(screen.getByTestId("browser-overlay-chrome"));
    const closeButton = leadingChrome.getByRole("button", {
      name: "Close Web Preview",
    });
    const backButton = leadingChrome.getByRole("button", { name: "Web back" });
    const forwardButton = leadingChrome.getByRole("button", {
      name: "Web forward",
    });

    expect(closeButton.closest("[data-overlay-shell='action']")).toHaveClass("size-11");
    expect(backButton.closest("[data-overlay-shell='action']")).toHaveClass("size-11");
    expect(forwardButton.closest("[data-overlay-shell='action']")).toHaveClass("size-11");
    expect(backButton.querySelector(".lucide-chevron-left")).not.toBeNull();
    expect(closeButton.querySelector(".lucide-x")).not.toBeNull();
    expect(backButton).toBeEnabled();
    expect(forwardButton).toBeDisabled();

    await user.click(closeButton);
    await user.click(backButton);
    expect(controller.handleCloseOverlay).toHaveBeenCalledTimes(1);
    expect(controller.handleGoBack).toHaveBeenCalledTimes(1);
    expect(controller.handleGoForward).not.toHaveBeenCalled();
  });

  it("closes the web preview when the back control has no browser history", async () => {
    const user = userEvent.setup();
    const controller = createController({
      browserState: {
        url: "https://example.com/article",
        can_go_back: false,
        can_go_forward: false,
        is_loading: false,
      },
    });

    render(
      <BrowserOverlayChrome
        controller={controller}
        presentation={createSurfacePresentation()}
        closeWebPreviewLabel="Close Web Preview"
      />,
    );

    const backButton = within(screen.getByTestId("browser-overlay-chrome")).getByRole("button", {
      name: "Web back",
    });
    expect(backButton).toBeEnabled();

    await user.click(backButton);

    expect(controller.handleCloseOverlay).toHaveBeenCalledTimes(1);
    expect(controller.handleGoBack).not.toHaveBeenCalled();
  });

  it("keeps the macOS overlay leading action outside the traffic-light safe gutter", () => {
    const controller = createController({
      geometry: {
        ...createController().geometry,
        chrome: {
          ...createController().geometry.chrome,
          leadingSafeInset: 72,
          leading: {
            left: 72,
            top: 12,
          },
        },
      },
    });
    const presentation = createSurfacePresentation();

    render(
      <BrowserOverlayChrome
        controller={controller}
        presentation={presentation}
        closeWebPreviewLabel="Close Web Preview"
      />,
    );

    expect(screen.getByTestId("browser-overlay-leading-action")).toHaveStyle({
      left: "72px",
      top: "12px",
    });
  });

  it("renders compact semantic action surfaces for narrow browser chrome", () => {
    const controller = createController({
      geometry: {
        ...createController().geometry,
        compact: true,
      },
    });
    const presentation = createSurfacePresentation({
      leadingActionSurface: {
        compact: true,
        tone: "default",
      },
      actionButtonSurface: {
        compact: true,
        tone: "default",
      },
    });

    render(
      <BrowserOverlayChrome
        controller={controller}
        presentation={presentation}
        closeWebPreviewLabel="Close Web Preview"
      />,
    );

    const closeButton = within(screen.getByTestId("browser-overlay-chrome")).getByRole("button", {
      name: "Close Web Preview",
    });
    const externalButton = screen.getByRole("button", {
      name: /open in external browser/i,
    });

    expect(closeButton.closest("[data-overlay-shell='action']")).toHaveClass("size-11");
    expect(externalButton.closest("[data-overlay-shell='action']")).toHaveClass("size-11");
  });

  it("keeps custom toolbar actions inside the shared chrome shell action lane", async () => {
    const user = userEvent.setup();
    const controller = createController();
    const presentation = createSurfacePresentation();
    const onCustomAction = vi.fn();

    render(
      <BrowserOverlayChrome
        controller={controller}
        presentation={presentation}
        closeWebPreviewLabel="Close Web Preview"
        toolbarActions={[
          {
            key: "a",
            label: "Custom Action A",
            onClick: onCustomAction,
            icon: <span>A</span>,
          },
        ]}
      />,
    );

    expect(screen.getByRole("button", { name: "Custom Action A" })).toBeInTheDocument();
    const firstSurface = screen
      .getByRole("button", { name: "Custom Action A" })
      .closest("[data-overlay-shell='action']");

    expect(firstSurface).toHaveAttribute("data-overlay-shell", "action");
    expect(firstSurface).toHaveClass("bg-transparent");
    expect(firstSurface).toHaveClass("shadow-none");

    await user.click(screen.getByRole("button", { name: "Custom Action A" }));

    expect(onCustomAction).toHaveBeenCalledTimes(1);
  });

  it("renders browser actions before custom trailing actions on the right side", () => {
    const controller = createController();
    const presentation = createSurfacePresentation();

    render(
      <BrowserOverlayChrome
        controller={controller}
        presentation={presentation}
        closeWebPreviewLabel="Close Web Preview"
        toolbarActions={shareToolbarActions}
      />,
    );

    const toolbarButtons = within(screen.getByTestId("browser-overlay-actions"))
      .getAllByRole("button")
      .map((button) => button.getAttribute("aria-label"))
      .filter((label): label is string => label !== null);

    expect(toolbarButtons).toEqual(["Reload page", "Open in External Browser", "Share"]);
  });

  it("keeps trailing chrome tooltips out of the native webview area", async () => {
    const user = userEvent.setup();

    render(
      <BrowserOverlayChrome
        controller={createController()}
        presentation={createSurfacePresentation()}
        closeWebPreviewLabel="Close Web Preview"
        toolbarActions={shareToolbarActions}
      />,
    );

    await user.hover(screen.getByRole("button", { name: "Open in External Browser" }));

    expect(await screen.findByText("Open in External Browser")).toHaveAttribute("data-app-tooltip-side", "left");
  });

  it("spins the back icon briefly after an accepted click", async () => {
    vi.useFakeTimers();
    const controller = createController({
      browserState: {
        url: "https://example.com/article",
        can_go_back: true,
        can_go_forward: false,
        is_loading: false,
      },
    });

    render(
      <BrowserOverlayChrome
        controller={controller}
        presentation={createSurfacePresentation()}
        closeWebPreviewLabel="Close Web Preview"
      />,
    );

    const backButton = screen.getByRole("button", { name: "Web back" });
    const icon = backButton.querySelector("svg");

    expect(icon).not.toHaveClass("animate-spin");

    fireEvent.click(backButton);

    expect(controller.handleGoBack).toHaveBeenCalledTimes(1);
    expect(icon).toHaveClass("animate-spin");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(999);
    });
    expect(icon).toHaveClass("animate-spin");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(icon).not.toHaveClass("animate-spin");
  });

  it("does not start reload feedback when the action is disabled", () => {
    vi.useFakeTimers();
    const controller = createController({ browserState: null });

    render(
      <BrowserOverlayChrome
        controller={controller}
        presentation={createSurfacePresentation()}
        closeWebPreviewLabel="Close Web Preview"
      />,
    );

    const reloadButton = screen.getByRole("button", { name: "Reload page" });
    const icon = reloadButton.querySelector("svg");

    fireEvent.click(reloadButton);

    expect(controller.handleReload).not.toHaveBeenCalled();
    expect(icon).not.toHaveClass("animate-spin");
  });
});
