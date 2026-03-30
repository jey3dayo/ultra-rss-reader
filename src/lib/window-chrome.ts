import type { PlatformInfo } from "@/api/schemas";

type DesktopOverlayTitlebarOptions = {
  platformKind: PlatformInfo["kind"];
  hasTauriRuntime: boolean;
};

export function hasTauriRuntime(): boolean {
  return typeof window !== "undefined" && window.__TAURI_INTERNALS__ != null;
}

export function shouldUseDesktopOverlayTitlebar({
  platformKind,
  hasTauriRuntime,
}: DesktopOverlayTitlebarOptions): boolean {
  return hasTauriRuntime && platformKind === "macos";
}
