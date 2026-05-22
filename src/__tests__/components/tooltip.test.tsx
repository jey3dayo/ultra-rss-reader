import { render, screen } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MOTION_POPUP_SURFACE_CLASS_NAME } from "@/constants";
import { APP_STACKING_CLASS_NAMES } from "@/lib/window/window-chrome";

const tooltipPrimitiveCalls = vi.hoisted(() => ({
  positionerProps: [] as Array<{
    align?: "start" | "center" | "end";
    className?: string;
    side?: "top" | "right" | "bottom" | "left";
    sideOffset?: number;
  }>,
  triggerRenderProps: [] as ReactElement[],
}));

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
    className?: string;
  };

  type PopupProps = PrimitiveProps & {
    className?: string;
    "data-app-tooltip-side"?: string;
  };

  return {
    Tooltip: {
      Provider: ({ children }: PrimitiveProps) => <div data-base-ui-tooltip-provider>{children}</div>,
      Root: ({ children }: PrimitiveProps) => <div data-base-ui-tooltip-root>{children}</div>,
      Trigger: ({ render: trigger }: TriggerProps) => {
        tooltipPrimitiveCalls.triggerRenderProps.push(trigger);
        return trigger;
      },
      Portal: ({ children }: PrimitiveProps) => <div data-base-ui-tooltip-portal>{children}</div>,
      Positioner: ({ children, side, align, sideOffset, className }: PositionerProps) => {
        tooltipPrimitiveCalls.positionerProps.push({ align, className, side, sideOffset });
        return (
          <div
            className={className}
            data-base-ui-tooltip-positioner
            data-align={align}
            data-side={side}
            data-side-offset={sideOffset}
          >
            {children}
          </div>
        );
      },
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
  beforeEach(() => {
    tooltipPrimitiveCalls.positionerProps = [];
    tooltipPrimitiveCalls.triggerRenderProps = [];
  });

  it("renders the trigger element as the Base UI render prop and passes default placement to Base UI", () => {
    const triggerElement = (
      <button className="trigger-class" data-trigger-contract type="button">
        Subscriptions
      </button>
    );

    render(
      <TooltipProvider>
        <AppTooltip label="Open subscriptions">{triggerElement}</AppTooltip>
      </TooltipProvider>,
    );

    expect(tooltipPrimitiveCalls.triggerRenderProps).toEqual([triggerElement]);

    const trigger = screen.getByRole("button", { name: "Subscriptions" });
    expect(trigger).toHaveAttribute("data-trigger-contract");
    expect(trigger).toHaveClass("trigger-class");

    expect(screen.getByText("Open subscriptions")).toHaveAttribute("data-app-tooltip-side", "bottom");
    expect(screen.getByText("Open subscriptions")).toHaveClass(MOTION_POPUP_SURFACE_CLASS_NAME);
    expect(tooltipPrimitiveCalls.positionerProps).toEqual([
      { align: "center", className: APP_STACKING_CLASS_NAMES.tooltip, side: "bottom", sideOffset: 8 },
    ]);
    expect(screen.getByText("Open subscriptions").parentElement).toHaveAttribute("data-side", "bottom");
    expect(screen.getByText("Open subscriptions").parentElement).toHaveAttribute("data-align", "center");
    expect(screen.getByText("Open subscriptions").parentElement).toHaveAttribute("data-side-offset", "8");
    expect(screen.getByText("Open subscriptions").parentElement).toHaveClass(APP_STACKING_CLASS_NAMES.tooltip);
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
    expect(tooltipPrimitiveCalls.positionerProps).toEqual([
      { align: "start", className: APP_STACKING_CLASS_NAMES.tooltip, side: "left", sideOffset: 12 },
    ]);
    expect(screen.getByText("Open externally").parentElement).toHaveAttribute("data-side", "left");
    expect(screen.getByText("Open externally").parentElement).toHaveAttribute("data-align", "start");
    expect(screen.getByText("Open externally").parentElement).toHaveAttribute("data-side-offset", "12");
  });
});
