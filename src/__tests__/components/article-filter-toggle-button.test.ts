import { describe, expect, it } from "vitest";
import { articleFilterToggleButtonClassName } from "@/components/shared/article-filter-toggle-button";

describe("ArticleFilterToggleButton contracts", () => {
  it("keeps the all-mode pressed contract neutral and shared with control chips", () => {
    const className = articleFilterToggleButtonClassName({ mode: "all", size: "filter" });

    expect(className).toContain("motion-contextual-surface");
    expect(className).toContain("rounded-md");
    expect(className).toContain("h-7");
    expect(className).toContain("text-[13px]");
    expect(className).toContain("data-[pressed]:bg-surface-4");
    expect(className).toContain("data-[pressed]:text-foreground");
    expect(className).toContain("data-[pressed]:shadow-[var(--control-chip-pressed-shadow)]");
    expect(className).not.toContain("semantic-tone-unread");
    expect(className).not.toContain("semantic-tone-starred");
  });

  it("keeps the article filter size contract on supported shared chip sizes", () => {
    expect(articleFilterToggleButtonClassName({ mode: "all", size: "compact" })).toContain("text-xs");
    expect(articleFilterToggleButtonClassName({ mode: "all", size: "filter" })).toContain("text-[13px]");
    expect(articleFilterToggleButtonClassName({ mode: "all", size: "comfortable" })).toContain("text-sm");
  });
});
