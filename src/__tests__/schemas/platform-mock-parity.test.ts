import { mockPlatformInfo } from "@tests/helpers/tauri-mocks";
import { describe, expect, it } from "vitest";
import { PlatformInfoSchema } from "@/api/schemas";
import { DEFAULT_PLATFORM_CAPABILITIES, PLATFORM_KINDS } from "@/constants/platform";
import platformSource from "../../../src-tauri/src/platform/mod.rs?raw";

function extractPlatformCapabilityFields(source: string): string[] {
  const match = source.match(/pub struct PlatformCapabilities\s*\{(?<body>[\s\S]*?)\n\}/);
  if (!match?.groups?.body) {
    throw new Error("PlatformCapabilities struct not found");
  }

  return [...match.groups.body.matchAll(/pub\s+([a-z0-9_]+)\s*:/g)].map(([, field]) => field);
}

function extractPlatformKindValues(source: string): string[] {
  const match = source.match(/pub enum PlatformKind\s*\{(?<body>[\s\S]*?)\n\}/);
  if (!match?.groups?.body) {
    throw new Error("PlatformKind enum not found");
  }

  return [...match.groups.body.matchAll(/^\s*([A-Z][A-Za-z0-9_]*)\s*,/gm)].map(([, variant]) =>
    variant.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase(),
  );
}

describe("platform mock parity", () => {
  it("keeps mocked platform capabilities aligned with the real DTO field set", () => {
    const realCapabilityFields = extractPlatformCapabilityFields(platformSource);
    const mockCapabilityFields = Object.keys(mockPlatformInfo.capabilities);
    const missingMockFields = realCapabilityFields.filter((field) => !mockCapabilityFields.includes(field));
    const staleMockFields = mockCapabilityFields.filter((field) => !realCapabilityFields.includes(field));

    expect(PlatformInfoSchema.parse(mockPlatformInfo)).toEqual(mockPlatformInfo);
    expect(missingMockFields).toEqual([]);
    expect(staleMockFields).toEqual([]);
  });

  it("keeps frontend platform kinds aligned with the native DTO kind set", () => {
    expect(extractPlatformKindValues(platformSource)).toEqual([...PLATFORM_KINDS]);
  });

  it("rejects stale platform DTO keys instead of silently widening the contract", () => {
    const platformWithExtraCapability = {
      kind: "windows",
      capabilities: {
        ...DEFAULT_PLATFORM_CAPABILITIES,
        supports_runtime_window_icon_replacement: true,
        supports_native_browser_navigation: true,
        stale_capability: true,
      },
    };
    const platformWithExtraTopLevelKey = {
      kind: "windows",
      capabilities: {
        ...DEFAULT_PLATFORM_CAPABILITIES,
        supports_runtime_window_icon_replacement: true,
        supports_native_browser_navigation: true,
      },
      stale_top_level_key: true,
    };

    expect(PlatformInfoSchema.safeParse(platformWithExtraCapability).success).toBe(false);
    expect(PlatformInfoSchema.safeParse(platformWithExtraTopLevelKey).success).toBe(false);
  });
});
