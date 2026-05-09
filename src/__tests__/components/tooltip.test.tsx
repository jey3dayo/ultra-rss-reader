import { render, screen } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { MOTION_POPUP_SURFACE_CLASS_NAME } from "@/constants";

vi.mock("@base-ui/react/tooltip", () => {
  type PrimitiveProps = {
    children?: ReactNode;
  };

  type TriggerProps = {
    render: ReactElement;
  };

  type PositionerProps = PrimitiveProps & {
    side?: "top" | "right" | "bottom" | "left";
    align?: "start" | "center" | "end";
    sideOffset?: number;
  };

  type PopupProps = PrimitiveProps & {
    className?: string;
    "data-app-tooltip-side"?: string;
  };

  return {
    Tooltip: {
      Provider: ({ children }: PrimitiveProps) => <div data-base-ui-tooltip-provider>{children}</div>,
      Root: ({ children }: PrimitiveProps) => <div data-base-ui-tooltip-root>{children}</div>,
      Trigger: ({ render: trigger }: TriggerProps) => trigger,
      Portal: ({ children }: PrimitiveProps) => <div data-base-ui-tooltip-portal>{children}</div>,
      Positioner: ({ children, side, align, sideOffset }: PositionerProps) => (
        <div data-base-ui-tooltip-positioner data-align={align} data-side={side} data-side-offset={sideOffset}>
          {children}
        </div>
      ),
      Popup: ({ children, className, "data-app-tooltip-side": appTooltipSide }: PopupProps) => (
        <div className={className} data-app-tooltip-side={appTooltipSide}>
          {children}
        </div>
      ),
    },
  };
});

import { AppTooltip, TooltipProvider } from "@/components/ui/tooltip";

describe("AppTooltip", () => {
  it("renders the trigger element as the Base UI render prop and applies default popup placement", () => {
    render(
      <TooltipProvider>
        <AppTooltip label="Open subscriptions">
          <button className="trigger-class" data-trigger-contract type="button">
            Subscriptions
          </button>
        </AppTooltip>
      </TooltipProvider>,
    );

    const trigger = screen.getByRole("button", { name: "Subscriptions" });
    expect(trigger).toHaveAttribute("data-trigger-contract");
    expect(trigger).toHaveClass("trigger-class");

    expect(screen.getByText("Open subscriptions")).toHaveAttribute("data-app-tooltip-side", "bottom");
    expect(screen.getByText("Open subscriptions")).toHaveClass(MOTION_POPUP_SURFACE_CLASS_NAME);
    expect(screen.getByText("Open subscriptions").parentElement).toHaveAttribute("data-side", "bottom");
    expect(screen.getByText("Open subscriptions").parentElement).toHaveAttribute("data-align", "center");
    expect(screen.getByText("Open subscriptions").parentElement).toHaveAttribute("data-side-offset", "8");
  });

  it("passes placement overrides through to the Base UI positioner and popup side marker", () => {
    render(
      <TooltipProvider>
        <AppTooltip label="Open externally" side="left" align="start" sideOffset={12}>
          <button type="button">Open</button>
        </AppTooltip>
      </TooltipProvider>,
    );

    expect(screen.getByText("Open externally")).toHaveAttribute("data-app-tooltip-side", "left");
    expect(screen.getByText("Open externally").parentElement).toHaveAttribute("data-side", "left");
    expect(screen.getByText("Open externally").parentElement).toHaveAttribute("data-align", "start");
    expect(screen.getByText("Open externally").parentElement).toHaveAttribute("data-side-offset", "12");
  });
});
