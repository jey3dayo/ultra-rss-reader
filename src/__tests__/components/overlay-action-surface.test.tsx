import { render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it } from "vitest";
import { OverlayActionSurface } from "@/components/shared/overlay-action-surface";

describe("OverlayActionSurface", () => {
  it("requires compact to be explicit at the type level", () => {
    // @ts-expect-error compact is required for the shell control mode
    const props: ComponentProps<typeof OverlayActionSurface> = { children: "Missing compact" };

    expect(props).toBeDefined();
  });

  it("requires an explicit shell role variant and maps compact state to the shell action surface", () => {
    render(
      <>
        <OverlayActionSurface data-testid="compact-action" compact tone="default">
          <a href="#compact-action">Compact action</a>
        </OverlayActionSurface>
        <OverlayActionSurface data-testid="regular-action" compact={false} tone="subtle">
          <input aria-label="Regular action" defaultValue="Regular action" />
        </OverlayActionSurface>
      </>,
    );

    const compact = screen.getByTestId("compact-action");
    const regular = screen.getByTestId("regular-action");

    expect(compact).toHaveAttribute("data-overlay-shell", "action");
    expect(compact).toHaveClass("rounded-lg");
    expect(compact).toHaveClass("bg-overlay-action-surface");
    expect(compact).toHaveClass("size-11");
    expect(compact).toHaveClass("motion-pressable-surface");
    expect(compact.className).toContain("has-[:focus-visible]:ring-2");
    expect(compact.className).not.toContain("has-[:active]:scale-[0.97]");
    expect(compact.className).not.toContain("focus-visible:ring-2");
    expect(compact.className).not.toContain("active:scale-[0.97]");
    expect(compact.className).not.toContain("button:");

    expect(regular).toHaveAttribute("data-overlay-shell", "action");
    expect(regular).toHaveClass("rounded-lg");
    expect(regular).toHaveClass("h-8");
    expect(regular).toHaveClass("px-3");
    expect(regular).toHaveClass("bg-overlay-action-surface-subtle");
  });
});
