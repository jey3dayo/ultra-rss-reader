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
});
