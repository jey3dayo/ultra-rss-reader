import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ScrollArea } from "@/components/ui/scroll-area";

describe("ScrollArea", () => {
  it("applies shrink-safe root sizing by default", () => {
    render(
      <ScrollArea data-testid="scroll-area" className="flex-1">
        <div>Scrollable content</div>
      </ScrollArea>,
    );

    expect(screen.getByTestId("scroll-area")).toHaveClass("min-h-0");
    expect(screen.getByTestId("scroll-area")).toHaveClass("flex-1");
  });

  it("uses a neutral focus treatment on the viewport", () => {
    render(
      <ScrollArea data-testid="scroll-area">
        <div>Scrollable content</div>
      </ScrollArea>,
    );

    const viewport = screen.getByTestId("scroll-area").querySelector('[data-slot="scroll-area-viewport"]');

    expect(viewport).toHaveClass("focus-visible:outline-border/80");
    expect(viewport).toHaveClass("focus-visible:ring-border/35");
    expect(viewport).not.toHaveClass("focus-visible:ring-ring/50");
  });
});
