import { describe, expect, it } from "vitest";
import {
  FEED_DROP_TARGET_ID_ATTRIBUTE,
  FEED_DROP_TARGET_KIND_ATTRIBUTE,
  getFeedDropTargetFromElement,
  isSameFeedDropTarget,
} from "@/components/reader/feed-tree-drop-target";

describe("isSameFeedDropTarget", () => {
  it("compares folder targets by folder id", () => {
    expect(
      isSameFeedDropTarget(
        { kind: "folder", folderId: "folder-1" },
        { kind: "folder", folderId: "folder-1" },
      ),
    ).toBe(true);
    expect(
      isSameFeedDropTarget(
        { kind: "folder", folderId: "folder-1" },
        { kind: "folder", folderId: "folder-2" },
      ),
    ).toBe(false);
  });

  it("keeps unfoldered and null semantics", () => {
    expect(isSameFeedDropTarget({ kind: "unfoldered" }, { kind: "unfoldered" })).toBe(true);
    expect(isSameFeedDropTarget(null, null)).toBe(true);
    expect(isSameFeedDropTarget({ kind: "unfoldered" }, null)).toBe(false);
  });
});

describe("getFeedDropTargetFromElement", () => {
  it("resolves folder and unfoldered targets from data attributes", () => {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = `
      <div ${FEED_DROP_TARGET_KIND_ATTRIBUTE}="folder" ${FEED_DROP_TARGET_ID_ATTRIBUTE}="folder-1">
        <span id="folder-child"></span>
      </div>
      <button id="unfoldered" ${FEED_DROP_TARGET_KIND_ATTRIBUTE}="unfoldered"></button>
    `;

    expect(getFeedDropTargetFromElement(wrapper.querySelector("#folder-child"))).toEqual({
      kind: "folder",
      folderId: "folder-1",
    });
    expect(getFeedDropTargetFromElement(wrapper.querySelector("#unfoldered"))).toEqual({
      kind: "unfoldered",
    });
    expect(getFeedDropTargetFromElement(wrapper)).toBeNull();
  });
});
