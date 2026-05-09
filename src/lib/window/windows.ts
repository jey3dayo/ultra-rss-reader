import { Result } from "@praha/byethrow";

function readErrorLikeMessage(error: object): string | null {
  try {
    const message = Reflect.get(error, "message");
    return typeof message === "string" && message.length > 0 ? message : null;
  } catch {
    return null;
  }
}

function stringifyUnknownError(error: unknown): string {
  try {
    return String(error);
  } catch {
    return Object.prototype.toString.call(error);
  }
}

function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  if (error !== null && typeof error === "object") {
    const message = readErrorLikeMessage(error);
    return new Error(message ?? stringifyUnknownError(error));
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
