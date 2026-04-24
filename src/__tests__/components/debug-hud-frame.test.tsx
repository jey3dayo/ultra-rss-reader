import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DebugHudFrame } from "@/components/debug/debug-hud-frame";

describe("DebugHudFrame", () => {
  it("renders the panel surface as a quieter transparent shell", () => {
    render(
      <DebugHudFrame as="section" surface="panelCollapsed">
        Panel
      </DebugHudFrame>,
    );

    const frame = screen.getByText("Panel");

    expect(frame.tagName).toBe("SECTION");
    expect(frame).toHaveClass("pointer-events-auto");
    expect(frame).toHaveClass("rounded-[22px]");
    expect(frame).toHaveClass("border-white/8");
    expect(frame).toHaveClass("bg-black/42");
    expect(frame).not.toHaveClass("opacity-80");
    expect(frame).toHaveClass("shadow-[0_18px_40px_rgba(0,0,0,0.24)]");
    expect(frame).toHaveClass("backdrop-blur-xl");
    expect(frame).not.toHaveClass("hover:opacity-35");
  });

  it("renders the diagnostics strip surface with the compact pill styling", () => {
    render(<DebugHudFrame surface="stripCompact">Strip</DebugHudFrame>);

    const frame = screen.getByText("Strip");

    expect(frame).toHaveClass("pointer-events-none");
    expect(frame).toHaveClass("rounded-2xl");
    expect(frame).toHaveClass("backdrop-blur-xl");
  });
});
