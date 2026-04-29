import { render, screen } from "@testing-library/react";
import { Eye, X } from "lucide-react";
import { describe, expect, it } from "vitest";
import { MotionIconSwap } from "@/components/shared/motion-icon-swap";
import {
  MOTION_DATA_ICON_ATTRIBUTE,
  MOTION_DATA_STATE_ATTRIBUTE,
  MOTION_ICON_SWAP_CLASS_NAME,
  MOTION_ICON_SWAP_ICON_A,
  MOTION_ICON_SWAP_ICON_B,
  MOTION_ICON_SWAP_STATE_A,
  MOTION_ICON_SWAP_STATE_B,
} from "@/constants";

const motionIconSwapSelector = `.${MOTION_ICON_SWAP_CLASS_NAME}`;
const motionIconSlotASelector = `[${MOTION_DATA_ICON_ATTRIBUTE}="${MOTION_ICON_SWAP_ICON_A}"]`;
const motionIconSlotBSelector = `[${MOTION_DATA_ICON_ATTRIBUTE}="${MOTION_ICON_SWAP_ICON_B}"]`;

describe("MotionIconSwap", () => {
  it("renders both icons and exposes the active state through data attributes", () => {
    const { rerender } = render(
      <button type="button" aria-label="Open Web Preview">
        <MotionIconSwap
          state={MOTION_ICON_SWAP_STATE_A}
          iconA={<Eye data-testid="preview-open-icon" />}
          iconB={<X data-testid="preview-close-icon" />}
        />
      </button>,
    );

    const button = screen.getByRole("button", { name: "Open Web Preview" });
    const iconSwap = button.querySelector(motionIconSwapSelector);

    expect(iconSwap).not.toBeNull();
    expect(iconSwap).toHaveAttribute("aria-hidden", "true");
    expect(iconSwap).toHaveAttribute(MOTION_DATA_STATE_ATTRIBUTE, MOTION_ICON_SWAP_STATE_A);
    expect(iconSwap?.querySelector(motionIconSlotASelector)).toContainElement(screen.getByTestId("preview-open-icon"));
    expect(iconSwap?.querySelector(motionIconSlotBSelector)).toContainElement(screen.getByTestId("preview-close-icon"));

    rerender(
      <button type="button" aria-label="Close Web Preview">
        <MotionIconSwap
          state={MOTION_ICON_SWAP_STATE_B}
          iconA={<Eye data-testid="preview-open-icon" />}
          iconB={<X data-testid="preview-close-icon" />}
        />
      </button>,
    );

    expect(
      screen.getByRole("button", { name: "Close Web Preview" }).querySelector(motionIconSwapSelector),
    ).toHaveAttribute(MOTION_DATA_STATE_ATTRIBUTE, MOTION_ICON_SWAP_STATE_B);
  });
});
