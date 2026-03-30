type DesktopOverlayTitlebarOptions = {
  platform?: string;
  hasTauriRuntime?: boolean;
};

export function shouldUseDesktopOverlayTitlebar(options: DesktopOverlayTitlebarOptions = {}): boolean {
  const platform = options.platform ?? (typeof navigator !== "undefined" ? navigator.platform : "");
  const hasTauriRuntime =
    options.hasTauriRuntime ?? (typeof window !== "undefined" && window.__TAURI_INTERNALS__ != null);

  return hasTauriRuntime && platform.toLowerCase().includes("mac");
}
