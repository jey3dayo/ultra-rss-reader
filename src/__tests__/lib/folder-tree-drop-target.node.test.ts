// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  FOLDER_REORDER_TARGET_ATTRIBUTE,
  resolveFolderReorderInsertionIndex,
} from "@/lib/sidebar/folder-tree-drop-target";

function createDomRect(rect: { top: number; left: number; width: number; height: number }): DOMRect {
  return {
    x: rect.left,
    y: rect.top,
    width: rect.width,
    height: rect.height,
    top: rect.top,
    left: rect.left,
    right: rect.left + rect.width,
    bottom: rect.top + rect.height,
    toJSON: () => ({}),
  } as DOMRect;
}

describe("resolveFolderReorderInsertionIndex", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns null when the pointer is outside the folder reorder target bounds", () => {
    document.body.innerHTML = `
      <div ${FOLDER_REORDER_TARGET_ATTRIBUTE}="true"></div>
      <div ${FOLDER_REORDER_TARGET_ATTRIBUTE}="true"></div>
    `;
    const targets = Array.from(document.querySelectorAll<HTMLElement>(`[${FOLDER_REORDER_TARGET_ATTRIBUTE}="true"]`));
    targets[0].getBoundingClientRect = vi.fn(() => createDomRect({ top: 100, left: 20, width: 80, height: 20 }));
    targets[1].getBoundingClientRect = vi.fn(() => createDomRect({ top: 140, left: 20, width: 80, height: 20 }));

    expect(resolveFolderReorderInsertionIndex(10, 120)).toBeNull();
    expect(resolveFolderReorderInsertionIndex(200, 120)).toBeNull();
    expect(resolveFolderReorderInsertionIndex(60, 80)).toBeNull();
    expect(resolveFolderReorderInsertionIndex(60, 180)).toBeNull();
  });

  it("returns an insertion index when the pointer is inside the target bounds", () => {
    document.body.innerHTML = `
      <div ${FOLDER_REORDER_TARGET_ATTRIBUTE}="true"></div>
      <div ${FOLDER_REORDER_TARGET_ATTRIBUTE}="true"></div>
    `;
    const targets = Array.from(document.querySelectorAll<HTMLElement>(`[${FOLDER_REORDER_TARGET_ATTRIBUTE}="true"]`));
    targets[0].getBoundingClientRect = vi.fn(() => createDomRect({ top: 100, left: 20, width: 80, height: 20 }));
    targets[1].getBoundingClientRect = vi.fn(() => createDomRect({ top: 140, left: 20, width: 80, height: 20 }));

    expect(resolveFolderReorderInsertionIndex(60, 105)).toEqual({ insertionIndex: 0 });
    expect(resolveFolderReorderInsertionIndex(60, 155)).toEqual({ insertionIndex: 2 });
  });

  it("returns null for a pointer over rows' bounds but outside the clipping scroll container", () => {
    document.body.innerHTML = `
      <div ${FOLDER_REORDER_TARGET_ATTRIBUTE}="true"></div>
      <div ${FOLDER_REORDER_TARGET_ATTRIBUTE}="true"></div>
    `;
    const viewport = document.createElement("div");
    document.body.appendChild(viewport);
    viewport.getBoundingClientRect = vi.fn(() => createDomRect({ top: 100, left: 0, width: 200, height: 100 }));
    const targets = Array.from(document.querySelectorAll<HTMLElement>(`[${FOLDER_REORDER_TARGET_ATTRIBUTE}="true"]`));
    targets[0].getBoundingClientRect = vi.fn(() => createDomRect({ top: -100, left: 20, width: 80, height: 40 }));
    targets[1].getBoundingClientRect = vi.fn(() => createDomRect({ top: 140, left: 20, width: 80, height: 40 }));

    expect(resolveFolderReorderInsertionIndex(60, 50)).toEqual({ insertionIndex: 1 });
    expect(resolveFolderReorderInsertionIndex(60, 50, viewport)).toBeNull();
    expect(resolveFolderReorderInsertionIndex(60, 150, viewport)).toEqual({ insertionIndex: 1 });
  });
});
