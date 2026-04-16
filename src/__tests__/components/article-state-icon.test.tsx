import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StarIcon, UnreadIcon } from "@/components/shared/article-state-icon";

describe("UnreadIcon", () => {
  it("uses the shared unread tone instead of a hardcoded blue", () => {
    const { container } = render(<UnreadIcon unread={true} className="size-3" />);

    const icon = container.firstElementChild;
    expect(icon).not.toBeNull();
    expect(icon).toHaveClass("bg-[var(--tone-unread)]");
    expect(icon).toHaveClass("shadow-[0_0_0_1px_color-mix(in_srgb,var(--tone-unread)_45%,transparent)]");
  });

  it("can keep the unread tone visible even when the item is not unread", () => {
    const { container } = render(<UnreadIcon unread={false} forceTone className="size-3" />);

    const icon = container.firstElementChild;
    expect(icon).not.toBeNull();
    expect(icon).toHaveClass("border-2");
    expect(icon).toHaveClass("border-[color-mix(in_srgb,var(--tone-unread)_88%,transparent)]");
    expect(icon).toHaveClass("text-[var(--tone-unread)]");
  });

  it("can render the unread shape without applying the unread tone", () => {
    const { container } = render(<UnreadIcon unread={true} tone="none" className="size-3" />);

    const icon = container.firstElementChild;
    expect(icon).not.toBeNull();
    expect(icon).toHaveClass("bg-current");
    expect(icon).not.toHaveClass("text-[var(--tone-unread)]");
    expect(icon).not.toHaveClass("border-[color-mix(in_srgb,var(--tone-unread)_88%,transparent)]");
  });

  it("uses the shared starred tone instead of a hardcoded yellow", () => {
    const { container } = render(<StarIcon starred className="size-3" />);

    const icon = container.firstElementChild;
    expect(icon).not.toBeNull();
    expect(icon).toHaveClass("fill-[var(--tone-starred)]");
    expect(icon).toHaveClass("text-[var(--tone-starred)]");
  });

  it("can keep the starred tone visible even when the item is not starred", () => {
    const { container } = render(<StarIcon starred={false} forceTone className="size-3" />);

    const icon = container.firstElementChild;
    expect(icon).not.toBeNull();
    expect(icon).toHaveClass("text-[var(--tone-starred)]");
    expect(icon).not.toHaveClass("fill-[var(--tone-starred)]");
  });

  it("can render the starred shape without applying the starred tone", () => {
    const { container } = render(<StarIcon starred={true} tone="none" className="size-3" />);

    const icon = container.firstElementChild;
    expect(icon).not.toBeNull();
    expect(icon).not.toHaveClass("text-[var(--tone-starred)]");
    expect(icon).not.toHaveClass("fill-[var(--tone-starred)]");
  });
});
