import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BrowserOverlayChrome } from "@/components/reader/browser-overlay-chrome";
import type {
  BrowserOverlayChromeController,
  BrowserViewSurfacePresentation,
} from "@/components/reader/browser-view.types";

function createController(overrides?: Partial<BrowserOverlayChromeController>): BrowserOverlayChromeController {
  return {
    geometry: {
      compact: false,
      ultraCompact: false,
      chromeRail: {
        visible: true,
        left: 0,
        right: 0,
        top: 0,
        height: 56,
        radius: 0,
      },
      stage: {
        left: 0,
        top: 56,
        right: 0,
        bottom: 0,
        radius: 0,
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
    handleOpenExternal: vi.fn(async () => {}),
    ...overrides,
  };
}

function createSurfacePresentation(
  overrides?: Partial<BrowserViewSurfacePresentation>,
): BrowserViewSurfacePresentation {
  return {
    leadingActionSurface: {
      compact: false,
      tone: "default",
    },
    actionButtonSurface: {
      compact: false,
      tone: "default",
    },
    stageSurface: {
      scope: "main-stage",
    },
    ...overrides,
  };
}

describe("BrowserOverlayChrome", () => {
  it("renders only the close action for the image-viewer overlay chrome", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<BrowserOverlayChrome closeLabel="Close browser overlay" onClose={onClose} />);

    expect(screen.getAllByRole("button")).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Close browser overlay" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("keeps the close control as a ghost affordance with keyboard-visible focus and tactile active feedback", () => {
    render(<BrowserOverlayChrome closeLabel="Close browser overlay" onClose={() => {}} />);

    const closeButton = screen.getByRole("button", { name: "Close browser overlay" });
    const closeSurface = closeButton.closest("[data-overlay-shell='action']");

    expect(closeSurface).not.toBeNull();
    expect(closeSurface).toHaveAttribute("data-overlay-shell", "action");
    expect(closeSurface).toHaveClass("rounded-full");
    expect(closeSurface).toHaveClass("bg-background/72");
    expect(closeSurface).toHaveClass("border-border/70");
    expect(closeSurface?.className).toContain("has-[:focus-visible]:ring-2");
    expect(closeSurface?.className).toContain("has-[:active]:scale-[0.97]");
  });

  it("renders the browser overlay leading action as a back-to-reader pill on desktop", async () => {
    const user = userEvent.setup();
    const controller = createController();
    const presentation = createSurfacePresentation();

    render(
      <BrowserOverlayChrome controller={controller} presentation={presentation} backToReaderLabel="Back to Reader" />,
    );

    const leadingAction = within(screen.getByTestId("browser-overlay-chrome")).getByRole("button", {
      name: "Back to Reader",
    });
    const leadingSurface = leadingAction.closest("[data-overlay-shell='action']");

    expect(leadingAction).toHaveTextContent("Reader");
    expect(leadingSurface).not.toBeNull();
    expect(leadingSurface).toHaveAttribute("data-overlay-shell", "action");
    expect(leadingSurface).toHaveClass("rounded-full");
    expect(leadingSurface).toHaveClass("h-8");
    expect(leadingSurface).toHaveClass("px-3");
    expect(leadingAction.querySelector(".lucide-chevron-left")).not.toBeNull();
    expect(leadingAction.querySelector(".lucide-x")).toBeNull();

    await user.click(leadingAction);

    expect(controller.handleCloseOverlay).toHaveBeenCalledTimes(1);
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
      <BrowserOverlayChrome controller={controller} presentation={presentation} backToReaderLabel="Back to Reader" />,
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
      <BrowserOverlayChrome controller={controller} presentation={presentation} backToReaderLabel="Back to Reader" />,
    );

    const closeButton = within(screen.getByTestId("browser-overlay-chrome")).getByRole("button", {
      name: "Back to Reader",
    });
    const externalButton = screen.getByRole("button", { name: /open in external browser/i });

    expect(closeButton.closest("[data-overlay-shell='action']")).toHaveClass("size-11");
    expect(externalButton.closest("[data-overlay-shell='action']")).toHaveClass("size-11");
  });

  it("keeps custom toolbar actions inside the shared overlay action shell", () => {
    const controller = createController();
    const presentation = createSurfacePresentation();

    render(
      <BrowserOverlayChrome
        controller={controller}
        presentation={presentation}
        backToReaderLabel="Back to Reader"
        toolbarActions={({ renderAction }) => (
          <>
            {renderAction(<button type="button">Custom Action A</button>, { key: "a" })}
            {renderAction(<button type="button">Custom Action B</button>, { key: "b" })}
          </>
        )}
      />,
    );

    expect(screen.getByRole("button", { name: "Custom Action A" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Custom Action B" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Custom Action/ })).toHaveLength(2);
    expect(
      screen.getAllByRole("button", { name: /Custom Action/ })[0].closest("[data-overlay-shell='action']"),
    ).toHaveAttribute("data-overlay-shell", "action");
    expect(
      screen.getAllByRole("button", { name: /Custom Action/ })[1].closest("[data-overlay-shell='action']"),
    ).toHaveAttribute("data-overlay-shell", "action");
  });
});
