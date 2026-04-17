import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { IndeterminateProgress } from "@/components/shared/indeterminate-progress";

describe("IndeterminateProgress", () => {
  it("uses a semantic surface for the loading track", () => {
    const { container } = render(<IndeterminateProgress />);

    expect(container.firstElementChild).toHaveClass("bg-surface-3/72");
  });
});
