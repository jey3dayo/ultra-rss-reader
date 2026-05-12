type AnimationFrameScheduleOptions = {
  warningMessage?: string;
};

export function scheduleAnimationFrame(
  callback: FrameRequestCallback,
  options: AnimationFrameScheduleOptions = {},
): number | null {
  if (typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") {
    return null;
  }

  try {
    return window.requestAnimationFrame(callback);
  } catch (error) {
    if (options.warningMessage) {
      console.warn(options.warningMessage, error);
    }
    return null;
  }
}

export function cancelAnimationFrameHandle(frameHandle: number): void {
  if (typeof window === "undefined" || typeof window.cancelAnimationFrame !== "function") {
    return;
  }

  window.cancelAnimationFrame(frameHandle);
}

export function scheduleAnimationFrameWithTimeoutFallback(callback: () => void): () => void {
  if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
    const frameHandle = window.requestAnimationFrame(callback);
    return () => {
      cancelAnimationFrameHandle(frameHandle);
    };
  }

  const timeoutHandle = globalThis.setTimeout(callback, 0);
  return () => {
    globalThis.clearTimeout(timeoutHandle);
  };
}
