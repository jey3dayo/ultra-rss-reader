import { mockPlatformInfo } from "@tests/helpers/tauri-mocks";
import { describe, expect, it } from "vitest";
import { PlatformInfoSchema } from "@/api/schemas";
import platformSource from "../../../src-tauri/src/platform/mod.rs?raw";

function extractPlatformCapabilityFields(source: string): string[] {
  const match = source.match(/pub struct PlatformCapabilities\s*\{(?<body>[\s\S]*?)\n\}/);
  if (!match?.groups?.body) {
    throw new Error("PlatformCapabilities struct not found");
  }

  return [...match.groups.body.matchAll(/pub\s+([a-z0-9_]+)\s*:/g)].map(([, field]) => field);
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
});
