import { vi } from "vitest";
import { FEED_MOVE_FEED_ROW_ATTRIBUTE, FEED_MOVE_FOLDER_ROW_ATTRIBUTE } from "@/lib/sidebar/feed-move-animation";
import { FOLDER_REORDER_FOLDER_ID_ATTRIBUTE } from "@/lib/sidebar/folder-tree-drop-target";

export type MotionTestRow = {
  element: HTMLElement;
  animate: ReturnType<typeof vi.fn>;
  cancel: ReturnType<typeof vi.fn>;
  setTop: (top: number) => void;
};

export function mountMotionRow(parent: HTMLElement, attribute: string, id: string, top: number): MotionTestRow {
  const element = document.createElement("div");
  element.setAttribute(attribute, id);
  let currentTop = top;
  element.getBoundingClientRect = () => new DOMRect(0, currentTop, 0, 20);
  const cancel = vi.fn();
  const animate = vi.fn();
  animate.mockImplementation(() => ({ cancel }));
  element.animate = animate;
  parent.appendChild(element);
  return {
    element,
    animate,
    cancel,
    setTop: (nextTop) => {
      currentTop = nextTop;
    },
  };
}

export function mountMotionFeed(
  parent: HTMLElement,
  id: string,
  top: number,
): MotionTestRow & { button: MotionTestRow } {
  const row = mountMotionRow(parent, FEED_MOVE_FEED_ROW_ATTRIBUTE, id, top);
  const button = mountMotionRow(row.element, "data-feed-id", id, top);
  return { ...row, button };
}

export function mountMotionFolder(
  container: HTMLElement,
  id: string,
  headerTop: number,
): { section: HTMLElement; header: MotionTestRow; panel: HTMLElement } {
  const section = document.createElement("div");
  section.setAttribute(FOLDER_REORDER_FOLDER_ID_ATTRIBUTE, id);
  container.appendChild(section);
  const header = mountMotionRow(section, FEED_MOVE_FOLDER_ROW_ATTRIBUTE, id, headerTop);
  const panel = document.createElement("div");
  section.appendChild(panel);
  return { section, header, panel };
}
