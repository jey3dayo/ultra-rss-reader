import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MOTION_DIGIT_ANIMATING_CLASS_NAME } from "@/constants";
import { MotionNumber } from "@/design-system";

describe("MotionNumber", () => {
  it("uses the shared content-swap treatment by default", () => {
    render(<MotionNumber value={42} className="inline-flex" />);

    expect(screen.getByText("42")).toHaveClass("motion-content-swap", "tabular-nums", "inline-flex");
    expect(screen.getByText("42")).toHaveAttribute("data-motion-phase", "entering");
  });

  it("uses the transitions-dev digit pop-in treatment for short numeric labels", () => {
    const { container } = render(<MotionNumber value={42} variant="digit-pop" className="inline-flex" />);

    const number = container.querySelector(".t-digit-group");

    if (!number) {
      throw new Error("MotionNumber digit group was not rendered");
    }

    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(number).toHaveClass("t-digit-group", "is-animating", "tabular-nums", "inline-flex");
    expect(number.children).toHaveLength(2);
    expect(number.children[0]).toHaveClass("t-digit");
    expect(number.children[0]).toHaveTextContent("4");
    expect(number.children[0]).toHaveAttribute("data-stagger", "1");
    expect(number.children[1]).toHaveClass("t-digit");
    expect(number.children[1]).toHaveTextContent("2");
    expect(number.children[1]).toHaveAttribute("data-stagger", "2");
  });

  it("does not restart digit animation when the value is unchanged", () => {
    const { container, rerender } = render(<MotionNumber value={42} variant="digit-pop" className="inline-flex" />);
    const number = container.querySelector(".t-digit-group");

    if (!number) {
      throw new Error("MotionNumber digit group was not rendered");
    }

    number.classList.remove(MOTION_DIGIT_ANIMATING_CLASS_NAME);
    rerender(<MotionNumber value={42} variant="digit-pop" className="inline-flex" />);

    expect(number).not.toHaveClass(MOTION_DIGIT_ANIMATING_CLASS_NAME);
  });
});
