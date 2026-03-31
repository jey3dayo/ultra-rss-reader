import type { PlatformInfo } from "@/api/schemas";

export const SHORTCUT_MODIFIER_BY_PLATFORM = {
  macos: "\u2318",
  windows: "Ctrl",
  linux: "Ctrl",
  unknown: "Ctrl",
} as const satisfies Record<PlatformInfo["kind"], string>;
