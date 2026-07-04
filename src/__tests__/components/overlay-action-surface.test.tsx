import { render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it } from "vitest";
import { OverlayActionSurface } from "@/design-system";

describe("OverlayActionSurface", () => {
  it("requires compact to be explicit at the type level", () => {
    // @ts-expect-error negative type contract: OverlayActionSurface requires compact for shell control mode.
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

  it("keeps chrome actions visually borderless while preserving active and focus state hooks", () => {
    render(
      <OverlayActionSurface data-testid="chrome-action" compact variant="chrome">
        <button type="button">Chrome action</button>
      </OverlayActionSurface>,
    );

    const chrome = screen.getByTestId("chrome-action");

    expect(chrome).toHaveClass("bg-transparent", "text-foreground-soft", "shadow-none");
    expect(chrome.className).toContain("has-[:focus-visible]:ring-0");
    expect(chrome.className).toContain("has-[:active]:bg-transparent");
    expect(chrome).not.toHaveClass("border");
  });

  it("keeps disabled child controls from picking up shell hover colors", () => {
    render(
      <>
        <OverlayActionSurface data-testid="default-action" compact tone="default">
          <button type="button" disabled>
            Default action
          </button>
        </OverlayActionSurface>
        <OverlayActionSurface data-testid="subtle-action" compact={false} tone="subtle">
          <button type="button" disabled>
            Subtle action
          </button>
        </OverlayActionSurface>
        <OverlayActionSurface data-testid="chrome-action" compact variant="chrome">
          <button type="button" disabled>
            Chrome action
          </button>
        </OverlayActionSurface>
      </>,
    );

    expect(screen.getByTestId("default-action").className).toContain("has-[:disabled]:hover:border-border/75");
    expect(screen.getByTestId("default-action").className).toContain("has-[:disabled]:hover:bg-overlay-action-surface");
    expect(screen.getByTestId("subtle-action").className).toContain("has-[:disabled]:hover:border-border/70");
    expect(screen.getByTestId("subtle-action").className).toContain(
      "has-[:disabled]:hover:bg-overlay-action-surface-subtle",
    );
    expect(screen.getByTestId("chrome-action").className).toContain("has-[:disabled]:hover:text-foreground-soft");
  });
});
