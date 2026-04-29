import { Result } from "@praha/byethrow";

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
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
