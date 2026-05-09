import type { PlatformInfo } from "@/api/schemas";

export const PLATFORM_KINDS = ["macos", "windows", "linux", "unknown"] as const;
export type PlatformKind = (typeof PLATFORM_KINDS)[number];

export const DEFAULT_PLATFORM_CAPABILITIES = {
  supports_reading_list: false,
  supports_background_browser_open: false,
  supports_runtime_window_icon_replacement: false,
  supports_native_browser_navigation: false,
  uses_dev_file_credentials: false,
} as const satisfies PlatformInfo["capabilities"];
export type PlatformCapabilities = typeof DEFAULT_PLATFORM_CAPABILITIES;
export type PlatformCapabilityName = keyof typeof DEFAULT_PLATFORM_CAPABILITIES;
export type PlatformCapabilityDefault = PlatformCapabilities[PlatformCapabilityName];

export const DEFAULT_PLATFORM_INFO = {
  kind: "unknown",
  capabilities: DEFAULT_PLATFORM_CAPABILITIES,
} as const satisfies PlatformInfo;
export type DefaultPlatformInfo = typeof DEFAULT_PLATFORM_INFO;

export const SHORTCUT_MODIFIER_BY_PLATFORM = {
  macos: "\u2318",
  windows: "Ctrl",
  linux: "Ctrl",
  unknown: "Ctrl",
} as const satisfies Record<PlatformKind, string>;
