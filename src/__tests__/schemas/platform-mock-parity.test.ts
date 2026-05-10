import { mockPlatformInfo } from "@tests/helpers/tauri-mocks";
import { describe, expect, it } from "vitest";
import { PlatformInfoSchema } from "@/api/schemas";
import { DEFAULT_PLATFORM_CAPABILITIES, DEFAULT_PLATFORM_INFO, PLATFORM_KINDS } from "@/constants/platform";
import { DEV_MOCK_PLATFORM_INFO } from "@/dev/mocks";
import platformCommandsSource from "../../../src-tauri/src/commands/platform_commands.rs?raw";
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

function extractPlatformCapabilitiesForKind(source: string, rustKind: string): Record<string, boolean> {
  const match = [
    ...source.matchAll(
      /(?<kinds>PlatformKind::[A-Za-z]+(?:\s*\|\s*PlatformKind::[A-Za-z]+)*)\s*=>\s*PlatformCapabilities\s*\{(?<body>[\s\S]*?)\n\s*\}/g,
    ),
  ].find((candidate) => candidate.groups?.kinds.split("|").some((kind) => kind.trim() === `PlatformKind::${rustKind}`));
  if (!match?.groups?.body) {
    throw new Error(`PlatformKind::${rustKind} capabilities not found`);
  }

  return Object.fromEntries(
    [...match.groups.body.matchAll(/([a-z0-9_]+):\s*(true|false),/g)].map(([, field, value]) => [
      field,
      value === "true",
    ]),
  );
}

describe("platform mock parity", () => {
  it("keeps get_platform_info wired to the current native platform source", () => {
    expect(platformCommandsSource).toContain("pub fn get_platform_info() -> PlatformInfoDto");
    expect(platformCommandsSource).toContain("PlatformInfoDto::from(crate::platform::PlatformInfo::current())");
  });

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

  it("keeps mock and default platform capabilities aligned with native platform defaults", () => {
    expect(mockPlatformInfo).toEqual({
      kind: "windows",
      capabilities: extractPlatformCapabilitiesForKind(platformSource, "Windows"),
    });
    expect(DEFAULT_PLATFORM_INFO).toEqual({
      kind: "unknown",
      capabilities: extractPlatformCapabilitiesForKind(platformSource, "Unknown"),
    });
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

  it("normalizes unknown platform kinds to safe feature flag fallbacks", () => {
    expect(
      PlatformInfoSchema.parse({
        kind: "freebsd",
        capabilities: {
          supports_reading_list: true,
          supports_background_browser_open: true,
          supports_runtime_window_icon_replacement: true,
          supports_native_browser_navigation: true,
          uses_dev_file_credentials: true,
        },
      }),
    ).toEqual(DEFAULT_PLATFORM_INFO);
  });

  it("keeps browser dev platform mock on the default safe platform schema", () => {
    expect(PlatformInfoSchema.parse(DEV_MOCK_PLATFORM_INFO)).toEqual(DEFAULT_PLATFORM_INFO);
  });
});
