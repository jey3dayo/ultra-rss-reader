const FLIP_SPRING_OPTIONS: KeyframeAnimationOptions = {
  duration: 420,
  easing: "cubic-bezier(0.34, 1.56, 0.64, 1)",
  fill: "both",
};

const REDUCED_MOTION_HIGHLIGHT_MS = 150;

export function runFolderReorderDropAnimation(params: {
  container: HTMLElement | null;
  targetAttribute: string;
  reducedMotion: boolean;
}): void {
  const { container, targetAttribute, reducedMotion } = params;
  if (!container) {
    return;
  }

  const rows = Array.from(container.querySelectorAll<HTMLElement>(`[${targetAttribute}]`));
  if (rows.length === 0) {
    return;
  }

  if (reducedMotion) {
    for (const row of rows) {
      row.animate([{ backgroundColor: "var(--feed-tree-drop-target-surface)" }, { backgroundColor: "transparent" }], {
        duration: REDUCED_MOTION_HIGHLIGHT_MS,
        fill: "none",
      });
    }
    return;
  }

  const firstRects = new Map<string, DOMRect>();
  for (const row of rows) {
    const folderId = row.getAttribute("data-folder-reorder-folder-id");
    if (!folderId) {
      continue;
    }
    firstRects.set(folderId, row.getBoundingClientRect());
  }

  requestAnimationFrame(() => {
    for (const row of rows) {
      const folderId = row.getAttribute("data-folder-reorder-folder-id");
      if (!folderId) {
        continue;
      }

      const firstRect = firstRects.get(folderId);
      if (!firstRect) {
        continue;
      }

      const lastRect = row.getBoundingClientRect();
      const deltaY = firstRect.top - lastRect.top;
      if (Math.abs(deltaY) < 1) {
        continue;
      }

      row.animate([{ transform: `translateY(${deltaY}px)` }, { transform: "translateY(0)" }], FLIP_SPRING_OPTIONS);
    }
  });
}
