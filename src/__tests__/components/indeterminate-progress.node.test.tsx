import "@testing-library/jest-dom/vitest";
import { render } from "@testing-library/react";
import { setupBrowserTestDom } from "@tests/helpers/browser-test-globals";
import { describe, expect, it } from "vitest";
import { IndeterminateProgress } from "@/components/shared/indeterminate-progress";

setupBrowserTestDom();

describe("IndeterminateProgress", () => {
  it("uses a semantic surface for the loading track", () => {
    const { container } = render(<IndeterminateProgress />);

    expect(container.firstElementChild).toHaveClass("bg-surface-3/72");
  });

  it("uses the loading tone token for the moving bar", () => {
    const { container } = render(<IndeterminateProgress />);

    expect(container.firstElementChild?.firstElementChild).toHaveClass("bg-[var(--tone-loading)]");
    expect(container.firstElementChild?.firstElementChild).not.toHaveClass("bg-ring");
  });
});
