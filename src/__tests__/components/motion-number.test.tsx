import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MotionNumber } from "@/components/shared/motion-number";

describe("MotionNumber", () => {
  it("uses the shared content-swap treatment for short numeric labels", () => {
    render(<MotionNumber value={42} className="inline-flex" />);

    expect(screen.getByText("42")).toHaveClass("motion-content-swap", "tabular-nums", "inline-flex");
    expect(screen.getByText("42")).toHaveAttribute("data-motion-phase", "entering");
  });
});
