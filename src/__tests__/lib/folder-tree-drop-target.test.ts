import { afterEach, describe, expect, it } from "vitest";
import {
  FOLDER_REORDER_TARGET_ATTRIBUTE,
  resolveFolderReorderInsertionIndex,
} from "@/lib/sidebar/folder-tree-drop-target";

function rect(top: number, bottom: number, left = 0, right = 200): DOMRect {
  return { top, bottom, left, right, width: right - left, height: bottom - top, x: left, y: top, toJSON: () => ({}) };
}

function mountElement(parent: HTMLElement, bounds: DOMRect, attributes: Record<string, string> = {}) {
  const element = document.createElement("div");
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, value);
  }
  element.getBoundingClientRect = () => bounds;
  parent.appendChild(element);
  return element;
}

describe("resolveFolderReorderInsertionIndex", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  function mountTree() {
    const tree = mountElement(document.body, rect(0, 100));
    mountElement(tree, rect(0, 20), { [FOLDER_REORDER_TARGET_ATTRIBUTE]: "true" });
    mountElement(tree, rect(20, 40), { [FOLDER_REORDER_TARGET_ATTRIBUTE]: "true" });
    return tree;
  }

  it("resolves the gap under the pointer while it is inside the tree container", () => {
    const tree = mountTree();

    expect(resolveFolderReorderInsertionIndex(50, 5, tree)).toEqual({ insertionIndex: 0 });
    expect(resolveFolderReorderInsertionIndex(50, 35, tree)).toEqual({ insertionIndex: 2 });
  });

  it("returns no drop target when the pointer is released outside the tree container", () => {
    const tree = mountTree();

    expect(resolveFolderReorderInsertionIndex(50, 150, tree)).toBeNull();
    expect(resolveFolderReorderInsertionIndex(500, 30, tree)).toBeNull();
  });
});
