import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SectionHeading } from "@/components/shared/section-heading";

describe("SectionHeading", () => {
  it("renders an uppercase level-3 heading with shared styling", () => {
    render(<SectionHeading>Appearance</SectionHeading>);

    expect(screen.getByRole("heading", { level: 3, name: "Appearance" })).toHaveClass(
      "uppercase",
      "tracking-[0.18em]",
      "text-foreground-soft",
    );
  });
});
