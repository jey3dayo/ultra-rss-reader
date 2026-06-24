import { describe, expect, it } from "vitest";
import { articleFilterToggleButtonClassName } from "@/design-system";

describe("ArticleFilterToggleButton class contracts", () => {
  it("keeps the all-mode pressed contract neutral and shared with control chips", () => {
    const className = articleFilterToggleButtonClassName({
      mode: "all",
      size: "filter",
    });

    expect(className).toContain("motion-contextual-surface");
    expect(className).toContain("rounded-md");
    expect(className).toContain("min-h-11");
    expect(className).toContain("text-[13px]");
    expect(className).toContain("data-[pressed]:bg-surface-4");
    expect(className).toContain("data-[pressed]:text-foreground");
    expect(className).toContain("border-0");
    expect(className).toContain("bg-transparent");
    expect(className).toContain("shadow-none");
    expect(className).not.toContain("data-[pressed]:shadow-[var(--control-chip-pressed-shadow)]");
    expect(className).not.toContain("semantic-tone-unread");
    expect(className).not.toContain("semantic-tone-starred");
  });

  it("maps unread and starred modes to semantic pressed tone tokens", () => {
    const unreadClassName = articleFilterToggleButtonClassName({
      mode: "unread",
      size: "filter",
    });
    const starredClassName = articleFilterToggleButtonClassName({
      mode: "starred",
      size: "filter",
    });

    expect(unreadClassName).toContain("data-[pressed]:bg-[var(--semantic-tone-unread-surface)]");
    expect(unreadClassName).toContain("data-[pressed]:text-[var(--semantic-tone-unread-content-foreground)]");
    expect(unreadClassName).not.toContain("semantic-tone-starred");

    expect(starredClassName).toContain("data-[pressed]:bg-[var(--semantic-tone-starred-surface)]");
    expect(starredClassName).toContain("data-[pressed]:text-[var(--semantic-tone-starred-content-foreground)]");
    expect(starredClassName).not.toContain("semantic-tone-unread");
  });

  it("keeps the article filter size contract on supported shared chip sizes", () => {
    expect(articleFilterToggleButtonClassName({ mode: "all", size: "compact" })).toContain("text-xs");
    expect(articleFilterToggleButtonClassName({ mode: "all", size: "filter" })).toContain("text-[13px]");
    expect(articleFilterToggleButtonClassName({ mode: "all", size: "comfortable" })).toContain("text-sm");
  });
});
