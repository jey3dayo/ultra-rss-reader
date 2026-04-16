import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { UnreadIcon } from "@/components/shared/article-state-icon";

describe("UnreadIcon", () => {
  it("uses the shared unread tone instead of a hardcoded blue", () => {
    const { container } = render(<UnreadIcon unread={true} className="size-3" />);

    const icon = container.firstElementChild;
    expect(icon).not.toBeNull();
    expect(icon).toHaveClass("bg-[var(--tone-unread)]");
    expect(icon).toHaveClass("shadow-[0_0_0_1px_color-mix(in_srgb,var(--tone-unread)_45%,transparent)]");
  });
});
