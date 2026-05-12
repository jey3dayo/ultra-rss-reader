import { setupBrowserTestDom } from "@tests/helpers/browser-test-globals";
import { describe, expect, it } from "vitest";
import { queryElementByDataAttribute } from "@/lib/dom/data-attribute";

setupBrowserTestDom();

describe("data-attribute", () => {
  it("returns the first element with the matching data attribute value", () => {
    const root = document.createElement("div");
    const first = document.createElement("button");
    const second = document.createElement("button");
    first.setAttribute("data-article-id", "article-1");
    second.setAttribute("data-article-id", "article-2");
    root.append(first, second);

    expect(queryElementByDataAttribute<HTMLButtonElement>(root, "data-article-id", "article-2")).toBe(second);
  });

  it("returns null for non data attribute names", () => {
    const root = document.createElement("div");
    const button = document.createElement("button");
    button.setAttribute("aria-label", "article-1");
    root.append(button);

    expect(queryElementByDataAttribute(root, "aria-label", "article-1")).toBeNull();
  });

  it("returns null for unexpected data attribute names without leaking selector errors", () => {
    const root = document.createElement("div");
    root.append(document.createElement("button"));

    expect(queryElementByDataAttribute(root, "data-article-id]", "article-1")).toBeNull();
    expect(queryElementByDataAttribute(root, 'data-article-id"', "article-1")).toBeNull();
    expect(queryElementByDataAttribute(root, "data-article id", "article-1")).toBeNull();
    expect(queryElementByDataAttribute(root, "data-Article-id", "article-1")).toBeNull();
  });
});
