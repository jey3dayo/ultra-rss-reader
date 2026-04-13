import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DebugHudFrame } from "@/components/debug/debug-hud-frame";

describe("DebugHudFrame", () => {
  it("renders the interactive panel surface as a section", () => {
    render(
      <DebugHudFrame as="section" surface="panelCollapsed">
        Panel
      </DebugHudFrame>,
    );

    const frame = screen.getByText("Panel");

    expect(frame.tagName).toBe("SECTION");
    expect(frame).toHaveClass("pointer-events-auto");
    expect(frame).toHaveClass("rounded-2xl");
    expect(frame).toHaveClass("backdrop-blur-md");
  });

  it("renders the diagnostics strip surface with the compact pill styling", () => {
    render(<DebugHudFrame surface="stripCompact">Strip</DebugHudFrame>);

    const frame = screen.getByText("Strip");

    expect(frame).toHaveClass("pointer-events-none");
    expect(frame).toHaveClass("rounded-2xl");
    expect(frame).toHaveClass("backdrop-blur-xl");
  });
});
