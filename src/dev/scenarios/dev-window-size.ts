import { type DevWindowSize, readDevWindowSize } from "@/dev/intent";
import { DEV_SCENARIO_ID } from "@/dev/scenario-ids";
import {
  DEV_WINDOW_RESIZE_RETRY_DELAYS_MS,
  DEV_WINDOW_RESIZE_TOLERANCE_PX,
  DEV_WINDOW_UNMAXIMIZE_SETTLE_DELAY_MS,
} from "@/dev/scenarios/constants";

type WindowSizeLike = {
  width: number;
  height: number;
};

type RequestedWindowSize = Partial<DevWindowSize>;

type DevWindowLike = {
  scaleFactor(): Promise<number>;
  innerSize(): Promise<{
    toLogical(scaleFactor: number): {
      width: number;
      height: number;
    };
  }>;
};

type DevWindowSizeVerification = {
  currentSize: WindowSizeLike;
  isWithinTolerance: boolean;
};

type LogicalSizeConstructor<TSize> = new (width: number, height: number) => TSize;

type DevWindowResizeLike<TSize> = DevWindowLike & {
  setSize(size: TSize): Promise<void>;
  center(): Promise<void>;
};

async function readCurrentLogicalWindowSize(win: DevWindowLike): Promise<WindowSizeLike> {
  const scaleFactor = await win.scaleFactor();
  const logicalSize = (await win.innerSize()).toLogical(scaleFactor);
  return {
    width: Math.round(logicalSize.width),
    height: Math.round(logicalSize.height),
  };
}

async function resolveTargetLogicalWindowSize(
  win: DevWindowLike,
  requestedSize: RequestedWindowSize,
): Promise<WindowSizeLike> {
  const currentSize = await readCurrentLogicalWindowSize(win);
  return resolveTargetWindowSize(requestedSize, currentSize);
}

function resolveTargetWindowSize(requestedSize: RequestedWindowSize, currentSize: WindowSizeLike): WindowSizeLike {
  return {
    width: requestedSize.width ?? currentSize.width,
    height: requestedSize.height ?? currentSize.height,
  };
}

function isWindowSizeWithinTolerance(current: WindowSizeLike, target: WindowSizeLike): boolean {
  return (
    Math.abs(current.width - target.width) <= DEV_WINDOW_RESIZE_TOLERANCE_PX &&
    Math.abs(current.height - target.height) <= DEV_WINDOW_RESIZE_TOLERANCE_PX
  );
}

async function verifyCurrentLogicalWindowSize(
  win: DevWindowLike,
  targetSize: WindowSizeLike,
): Promise<DevWindowSizeVerification> {
  const currentSize = await readCurrentLogicalWindowSize(win);
  return {
    currentSize,
    isWithinTolerance: isWindowSizeWithinTolerance(currentSize, targetSize),
  };
}

async function applyVerifiedDevWindowResizeAttempt<TSize>(
  win: DevWindowResizeLike<TSize>,
  LogicalSize: LogicalSizeConstructor<TSize>,
  targetSize: WindowSizeLike,
  delayMs: number,
  shouldContinue: () => boolean,
): Promise<boolean> {
  if (delayMs > 0) {
    await wait(delayMs);
  }
  if (!shouldContinue()) {
    return true;
  }

  const verification = await verifyCurrentLogicalWindowSize(win, targetSize);
  if (!shouldContinue()) {
    return true;
  }
  if (verification.isWithinTolerance) {
    await win.center();
    return true;
  }

  await win.setSize(new LogicalSize(targetSize.width, targetSize.height));
  if (!shouldContinue()) {
    return true;
  }
  await win.center();
  return false;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export async function applyDevWindowSize(
  showToast: (message: string) => void,
  shouldContinue: () => boolean = () => true,
): Promise<void> {
  const requestedSize = readDevWindowSize();
  if (!requestedSize || !shouldContinue()) {
    return;
  }

  try {
    const [{ LogicalSize }, { getCurrentWindow }] = await Promise.all([
      import("@tauri-apps/api/dpi"),
      import("@tauri-apps/api/window"),
    ]);
    if (!shouldContinue()) {
      return;
    }
    const win = getCurrentWindow();

    if (await win.isMaximized()) {
      await win.unmaximize();
      await wait(DEV_WINDOW_UNMAXIMIZE_SETTLE_DELAY_MS);
      if (!shouldContinue()) {
        return;
      }
    }

    const targetSize = await resolveTargetLogicalWindowSize(win, requestedSize);
    if (!shouldContinue()) {
      return;
    }

    // Resize retries are sequential because each pass depends on the previous size, center, and settle delay.
    for (const delayMs of DEV_WINDOW_RESIZE_RETRY_DELAYS_MS) {
      if (!shouldContinue()) {
        return;
      }
      if (await applyVerifiedDevWindowResizeAttempt(win, LogicalSize, targetSize, delayMs, shouldContinue)) {
        return;
      }
    }

    if (!shouldContinue()) {
      return;
    }
    const finalVerification = await verifyCurrentLogicalWindowSize(win, targetSize);
    if (!finalVerification.isWithinTolerance) {
      console.warn(`Dev scenario "${DEV_SCENARIO_ID.openWebPreviewUrl}" did not reach the requested window size.`, {
        targetSize,
        finalSize: finalVerification.currentSize,
      });
      if (shouldContinue()) {
        showToast(`Dev scenario "${DEV_SCENARIO_ID.openWebPreviewUrl}" could not verify the requested window size.`);
      }
    }
  } catch (error) {
    if (!shouldContinue()) {
      return;
    }
    console.warn(
      `Dev scenario "${DEV_SCENARIO_ID.openWebPreviewUrl}" could not apply the requested window size.`,
      error,
    );
    showToast(`Dev scenario "${DEV_SCENARIO_ID.openWebPreviewUrl}" could not apply the requested window size.`);
  }
}
