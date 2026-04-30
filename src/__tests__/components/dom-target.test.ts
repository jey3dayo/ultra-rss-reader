import { describe, expect, it } from "vitest";
import { isOutsideElement } from "@/components/reader/dom-target";

describe("dom-target", () => {
  it("detects targets outside the given element", () => {
    const root = document.createElement("div");
    const child = document.createElement("button");
    const outside = document.createElement("button");
    root.append(child);

    expect(isOutsideElement(root, outside)).toBe(true);
    expect(isOutsideElement(root, child)).toBe(false);
    expect(isOutsideElement(root, root)).toBe(false);
  });

  it("ignores missing elements and non-node targets", () => {
    const root = document.createElement("div");
    const nonNodeTarget: EventTarget = new EventTarget();

    expect(isOutsideElement(null, root)).toBe(false);
    expect(isOutsideElement(root, null)).toBe(false);
    expect(isOutsideElement(root, nonNodeTarget)).toBe(false);
  });
});
