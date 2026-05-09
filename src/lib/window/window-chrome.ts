import type { PlatformInfo } from "@/api/schemas";

type DesktopOverlayTitlebarOptions = {
  platformKind: PlatformInfo["kind"];
  hasTauriRuntime: boolean;
};

type NavigatorWithOptionalUserAgentData = Navigator & {
  userAgentData?: {
    platform?: string;
  };
};

export const APP_STACKING_CLASS_NAMES = {
  browserOverlayRoot: "z-40",
  dialog: "z-50",
  commandPalette: "z-50",
  toast: "z-[100]",
} as const;

export const WORKSPACE_HEADER_STACKING_CLASS_NAMES = {
  dragRegion: "z-10",
  passiveContent: "z-20",
  interactiveControl: "z-30",
} as const;

export const LAYER_POINTER_EVENT_CLASS_NAMES = {
  inert: "pointer-events-none",
  interactive: "pointer-events-auto",
} as const;

export function hasTauriRuntime(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  if (window.__DEV_BROWSER_MOCKS__ === true || window.__ULTRA_RSS_BROWSER_MOCKS__ === true) {
    return false;
  }

  return window.__TAURI_INTERNALS__ != null;
}

function readUserAgentDataPlatform(navigator: NavigatorWithOptionalUserAgentData): string | null {
  return typeof navigator.userAgentData?.platform === "string" ? navigator.userAgentData.platform : null;
}

function looksLikeMacPlatform(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }

  const userAgentDataPlatform = readUserAgentDataPlatform(navigator);
  const platform = userAgentDataPlatform ?? navigator.platform ?? "";

  return /mac/i.test(platform);
}

export function shouldUseDesktopOverlayTitlebar({
  platformKind,
  hasTauriRuntime,
}: DesktopOverlayTitlebarOptions): boolean {
  if (!hasTauriRuntime) {
    return false;
  }

  if (platformKind === "macos") {
    return true;
  }

  // On the first desktop render, platform info can still be `unknown` even
  // though we already know we are inside the Tauri runtime. In that window we
  // still need to reserve macOS overlay titlebar space to avoid a one-frame
  // layout jump before platform info finishes loading.
  return platformKind === "unknown" && looksLikeMacPlatform();
}
