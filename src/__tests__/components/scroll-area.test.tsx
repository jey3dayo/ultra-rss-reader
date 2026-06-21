import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ScrollArea, ScrollBar } from "@/design-system";

function renderScrollBar({
  className,
  orientation,
  thumbClassName,
}: {
  className?: string;
  orientation?: "horizontal" | "vertical";
  thumbClassName?: string;
} = {}) {
  render(
    <ScrollBar
      className={className}
      data-testid="scrollbar"
      keepMounted
      orientation={orientation}
      thumbClassName={thumbClassName}
    />,
  );
}

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

  it("uses a neutral focus treatment on the viewport without dropping scrollbar overrides", () => {
    render(
      <ScrollArea data-testid="scroll-area" scrollbarClassName="custom-scrollbar" thumbClassName="custom-thumb">
        <div>Scrollable content</div>
      </ScrollArea>,
    );

    const viewport = screen.getByTestId("scroll-area").querySelector('[data-slot="scroll-area-viewport"]');

    expect(viewport).toHaveClass("focus-visible:outline-border/80");
    expect(viewport).toHaveClass("focus-visible:ring-border/35");
    expect(viewport).toHaveClass("overflow-auto");
    expect(viewport).not.toHaveClass("focus-visible:ring-ring/50");
  });

  it("passes scrollbar and thumb class overrides to the primitive slots", () => {
    render(<ScrollBar className="custom-scrollbar" thumbClassName="custom-thumb" keepMounted />);

    const scrollbar = document.querySelector('[data-slot="scroll-area-scrollbar"]');
    const thumb = document.querySelector('[data-slot="scroll-area-thumb"]');

    expect(scrollbar).toHaveClass("custom-scrollbar");
    expect(scrollbar).toHaveClass("h-full");
    expect(scrollbar).toHaveClass("w-2.5");
    expect(thumb).toHaveClass("custom-thumb");
    expect(thumb).toHaveClass("bg-border");
  });

  it("can render a shared scroll content lane wrapper with slot class overrides", () => {
    render(
      <ScrollArea
        data-testid="scroll-area"
        contentClassName="pb-4 pr-3"
        scrollbarClassName="custom-scrollbar"
        thumbClassName="custom-thumb"
      >
        <div>Scrollable content</div>
      </ScrollArea>,
    );

    const content = screen.getByTestId("scroll-area").querySelector('[data-slot="scroll-area-content"]');

    expect(content).toHaveClass("pb-4");
    expect(content).toHaveClass("pr-3");
  });

  it("does not mount decorative scrollbar slots inside native scroll areas", () => {
    render(
      <ScrollArea data-testid="scroll-area" scrollbarClassName="custom-scrollbar" thumbClassName="custom-thumb">
        <div>Scrollable content</div>
      </ScrollArea>,
    );

    const scrollArea = screen.getByTestId("scroll-area");

    expect(scrollArea.querySelector('[data-slot="scroll-area-scrollbar"]')).toBeNull();
    expect(scrollArea.querySelector('[data-slot="scroll-area-thumb"]')).toBeNull();
  });

  it("keeps vertical scrollbar orientation attributes and classes by default", () => {
    renderScrollBar({ className: "custom-scrollbar", thumbClassName: "custom-thumb" });

    expect(screen.getByTestId("scrollbar")).toHaveAttribute("data-orientation", "vertical");
    expect(screen.getByTestId("scrollbar")).toHaveClass("h-full");
    expect(screen.getByTestId("scrollbar")).toHaveClass("w-2.5");
    expect(screen.getByTestId("scrollbar")).toHaveClass("border-l");
    expect(screen.getByTestId("scrollbar")).toHaveClass("custom-scrollbar");
    expect(document.querySelector('[data-slot="scroll-area-thumb"]')).toHaveClass("custom-thumb");
    expect(screen.getByTestId("scrollbar")).not.toHaveClass("h-2.5");
    expect(screen.getByTestId("scrollbar")).not.toHaveClass("flex-col");
    expect(screen.getByTestId("scrollbar")).not.toHaveClass("border-t");
  });

  it("switches horizontal scrollbar orientation attributes and classes", () => {
    renderScrollBar({ className: "custom-scrollbar", orientation: "horizontal", thumbClassName: "custom-thumb" });

    expect(screen.getByTestId("scrollbar")).toHaveAttribute("data-orientation", "horizontal");
    expect(screen.getByTestId("scrollbar")).toHaveClass("h-2.5");
    expect(screen.getByTestId("scrollbar")).toHaveClass("flex-col");
    expect(screen.getByTestId("scrollbar")).toHaveClass("border-t");
    expect(screen.getByTestId("scrollbar")).toHaveClass("custom-scrollbar");
    expect(document.querySelector('[data-slot="scroll-area-thumb"]')).toHaveClass("custom-thumb");
    expect(screen.getByTestId("scrollbar")).not.toHaveClass("h-full");
    expect(screen.getByTestId("scrollbar")).not.toHaveClass("w-2.5");
    expect(screen.getByTestId("scrollbar")).not.toHaveClass("border-l");
  });
});
