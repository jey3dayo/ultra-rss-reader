const DEFAULT_EDGE_THRESHOLD_PX = 48;
const DEFAULT_MAX_STEP_PX = 18;

export function applyDragEdgeAutoScroll(params: {
  clientY: number;
  scrollContainer: HTMLElement | null | undefined;
  edgeThresholdPx?: number;
  maxStepPx?: number;
}): void {
  const {
    clientY,
    scrollContainer,
    edgeThresholdPx = DEFAULT_EDGE_THRESHOLD_PX,
    maxStepPx = DEFAULT_MAX_STEP_PX,
  } = params;
  if (!scrollContainer) {
    return;
  }

  const rect = scrollContainer.getBoundingClientRect();
  const distanceFromTop = clientY - rect.top;
  const distanceFromBottom = rect.bottom - clientY;

  if (distanceFromTop >= 0 && distanceFromTop < edgeThresholdPx) {
    const intensity = 1 - distanceFromTop / edgeThresholdPx;
    scrollContainer.scrollTop -= Math.ceil(maxStepPx * intensity);
    return;
  }

  if (distanceFromBottom >= 0 && distanceFromBottom < edgeThresholdPx) {
    const intensity = 1 - distanceFromBottom / edgeThresholdPx;
    scrollContainer.scrollTop += Math.ceil(maxStepPx * intensity);
  }
}
