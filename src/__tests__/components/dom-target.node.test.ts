import { setupBrowserTestDom } from "@tests/helpers/browser-test-globals";
import { describe, expect, it } from "vitest";
import { isOutsideElement } from "@/lib/dom/dom-target";

setupBrowserTestDom();

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

  it("treats composed shadow-boundary paths inside the element as inside", () => {
    const root = document.createElement("div");
    const host = document.createElement("div");
    const shadow = host.attachShadow({ mode: "open" });
    const button = document.createElement("button");
    shadow.append(button);
    root.append(host);
    document.body.append(root);

    let isOutside = true;
    document.addEventListener(
      "click",
      (event) => {
        isOutside = isOutsideElement(root, event);
      },
      { once: true },
    );

    button.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }));

    expect(isOutside).toBe(false);
    expect(isOutsideElement(root, button)).toBe(false);

    root.remove();
  });

  it("keeps host and detached node containment explicit", () => {
    const root = document.createElement("div");
    const host = document.createElement("div");
    const detached = document.createElement("button");
    root.append(host);

    expect(isOutsideElement(root, host)).toBe(false);
    expect(isOutsideElement(root, detached)).toBe(true);
  });

  it("ignores missing elements and non-node targets", () => {
    const root = document.createElement("div");
    const nonNodeTarget: EventTarget = new EventTarget();

    expect(isOutsideElement(null, root)).toBe(false);
    expect(isOutsideElement(root, null)).toBe(false);
    expect(isOutsideElement(root, nonNodeTarget)).toBe(false);
  });
});
