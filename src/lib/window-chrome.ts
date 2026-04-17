import type { PlatformInfo } from "@/api/schemas";

type DesktopOverlayTitlebarOptions = {
  platformKind: PlatformInfo["kind"];
  hasTauriRuntime: boolean;
};

export function hasTauriRuntime(): boolean {
  return typeof window !== "undefined" && window.__TAURI_INTERNALS__ != null;
}

function looksLikeMacPlatform(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }

  const userAgentDataPlatform =
    "userAgentData" in navigator
      ? (() => {
          const userAgentData = (
            navigator as Navigator & {
              userAgentData?: {
                platform?: string;
              };
            }
          ).userAgentData;

          return typeof userAgentData?.platform === "string" ? userAgentData.platform : null;
        })()
      : null;
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
