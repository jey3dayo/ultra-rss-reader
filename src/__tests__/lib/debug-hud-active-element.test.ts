import { describe, expect, it } from "vitest";
import {
  describeDebugHudActiveElement,
  describeDebugHudEventTarget,
  summarizeDebugHudActiveElementDescription,
} from "@/lib/debug-hud-active-element";

describe("debug-hud-active-element", () => {
  it("describes null and non-element targets as none", () => {
    expect(describeDebugHudActiveElement(null)).toBe("none");
    expect(describeDebugHudEventTarget(new Event("click"))).toBe("none");
  });

  it("includes stable element metadata in the active element description", () => {
    const button = document.createElement("button");
    button.dataset.debugHud = "";
    button.dataset.articleId = "art-1";
    button.dataset.browserOverlayReturnFocus = "article-list";
    button.dataset.testid = "article-row";
    button.setAttribute("role", "option");
    button.setAttribute("aria-label", "First article");

    expect(describeDebugHudActiveElement(button)).toBe(
      "button | debug-hud | article=art-1 | return=article-list | role=option | testid=article-row | label=First article",
    );
  });

  it("summarizes labels and role metadata from descriptions", () => {
    expect(summarizeDebugHudActiveElementDescription("button | role=option | label=First article")).toEqual({
      label: "First article",
      meta: "button | role=option",
    });
    expect(summarizeDebugHudActiveElementDescription("none")).toEqual({
      label: "none",
      meta: "none",
    });
  });
});
