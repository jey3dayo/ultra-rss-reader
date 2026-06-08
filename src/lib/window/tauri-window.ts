import { Result } from "@praha/byethrow";

const UNKNOWN_WINDOW_ERROR_MESSAGE = "Unknown window error";

export type WindowBadgeCountTarget = {
  setBadgeCount?: (count?: number) => Promise<void>;
};

function readErrorLikeMessage(error: object): string | null {
  try {
    const message = Reflect.get(error, "message");
    return typeof message === "string" && message.length > 0 ? message : null;
  } catch {
    return null;
  }
}

function stringifyUnknownError(error: unknown): string {
  if (error !== null && typeof error === "object") {
    return UNKNOWN_WINDOW_ERROR_MESSAGE;
  }

  try {
    return String(error);
  } catch {
    return UNKNOWN_WINDOW_ERROR_MESSAGE;
  }
}

function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  if (error !== null && typeof error === "object") {
    const message = readErrorLikeMessage(error);
    return new Error(message ?? stringifyUnknownError(error), { cause: error });
  }

  return new Error(stringifyUnknownError(error));
}

export function isWindowFullscreen() {
  return Result.try({
    try: async () => {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      return await getCurrentWindow().isFullscreen();
    },
    catch: toError,
  });
}

export function isWindowAlwaysOnTop() {
  return Result.try({
    try: async () => {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      return await getCurrentWindow().isAlwaysOnTop();
    },
    catch: toError,
  });
}

export function setWindowFullscreen(enabled: boolean) {
  return Result.try({
    try: async () => {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().setFullscreen(enabled);
    },
    catch: toError,
  });
}

export function setWindowAlwaysOnTop(enabled: boolean) {
  return Result.try({
    try: async () => {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().setAlwaysOnTop(enabled);
    },
    catch: toError,
  });
}

export function setWindowIcon(iconPath: string) {
  return Result.try({
    try: async () => {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().setIcon(iconPath);
    },
    catch: toError,
  });
}

export async function startWindowDragging(): Promise<void> {
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().startDragging();
}

export async function getWindowBadgeCountTarget(): Promise<WindowBadgeCountTarget> {
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  return await getCurrentWindow();
}
