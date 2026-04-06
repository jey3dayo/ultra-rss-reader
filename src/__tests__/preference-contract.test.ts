import { describe, expect, it } from "vitest";
import frontendSource from "@/stores/preferences-store.ts?raw";
import backendSource from "../../src-tauri/src/commands/preference_commands.rs?raw";

function extractBlock(source: string, pattern: RegExp, label: string): string {
  const matched = source.match(pattern)?.[1];
  if (!matched) {
    throw new Error(`Could not find ${label}`);
  }
  return matched;
}

function extractFrontendPreferenceKeys(source: string): string[] {
  const block = extractBlock(
    source,
    /const preferenceSchemas = \{([\s\S]*?)\} as const;/,
    "frontend preferenceSchemas block",
  );

  return [...block.matchAll(/^\s*([a-z_]+):/gm)].map((match) => match[1]);
}

function extractBackendAllowedKeys(source: string): string[] {
  const block = extractBlock(source, /const ALLOWED_KEYS: &\[&str\] = &\[([\s\S]*?)\];/, "backend ALLOWED_KEYS block");

  return [...block.matchAll(/"([a-z_]+)"/g)].map((match) => match[1]);
}

describe("preference contract", () => {
  it("keeps every frontend preference key allowed by the Tauri backend", () => {
    const frontendKeys = extractFrontendPreferenceKeys(frontendSource);
    const backendAllowedKeys = extractBackendAllowedKeys(backendSource);

    const missingInBackend = frontendKeys.filter((key) => !backendAllowedKeys.includes(key));

    expect(missingInBackend).toEqual([]);
  });
});
