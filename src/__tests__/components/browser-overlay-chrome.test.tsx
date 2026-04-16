import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BrowserOverlayChrome } from "@/components/reader/browser-overlay-chrome";
import type { BrowserOverlayChromeController } from "@/components/reader/browser-view.types";

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
    leadingActionClass:
      "pointer-events-auto h-8 rounded-full border border-border/75 bg-background/78 px-3 text-[0.8rem]",
    actionButtonClass: "pointer-events-auto rounded-full border border-border/75 bg-background/78",
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

    expect(closeButton.className).toContain("size-[46px]");
    expect(closeButton.className).toContain("focus-visible:ring-2");
    expect(closeButton.className).toContain("active:scale-[0.97]");
    expect(closeButton.className).toContain("bg-background/72");
    expect(closeButton.className).toContain("active:bg-card");
  });

  it("renders the browser overlay leading action as a back-to-reader pill on desktop", async () => {
    const user = userEvent.setup();
    const controller = createController();

    render(<BrowserOverlayChrome controller={controller} backToReaderLabel="Back to Reader" />);

    const leadingAction = within(screen.getByTestId("browser-overlay-chrome")).getByRole("button", {
      name: "Back to Reader",
    });

    expect(leadingAction).toHaveTextContent("Reader");
    expect(leadingAction.className).toContain("rounded-full");
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

    render(<BrowserOverlayChrome controller={controller} backToReaderLabel="Back to Reader" />);

    expect(screen.getByTestId("browser-overlay-leading-action")).toHaveStyle({
      left: "72px",
      top: "12px",
    });
  });
});
