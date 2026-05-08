import { describe, expect, it } from "vitest";
import keyboardShortcutsSource from "@/lib/keyboard/keyboard-shortcuts.ts?raw";
import {
  preferenceDefaults,
  resolvePreferenceValue,
} from "@/schemas/preferences";
import frontendSource from "@/schemas/preferences.ts?raw";
import backendSource from "../../../src-tauri/src/commands/preference_commands.rs?raw";

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
    /const preferenceSchemas = \{([\s\S]*?)\};/,
    "frontend preferenceSchemas block",
  );

  return [...block.matchAll(/^\s*([a-z_]+):/gm)].map((match) => match[1]);
}

function extractBackendAllowedKeys(source: string): string[] {
  const block = extractBlock(
    source,
    /const ALLOWED_KEYS: &\[&str\] = &\[([\s\S]*?)\];/,
    "backend ALLOWED_KEYS block",
  );

  return [...block.matchAll(/"([a-z_]+)"/g)].map((match) => match[1]);
}

function extractShortcutDefinitionIds(source: string): string[] {
  const block = extractBlock(
    source,
    /export const shortcutDefinitions[\s\S]*?= \[([\s\S]*?)\];/,
    "shortcutDefinitions block",
  );

  return [...block.matchAll(/^\s*id: "([a-z_]+)",/gm)].map((match) => match[1]);
}

function extractBackendAllowedShortcutIds(source: string): string[] {
  const block = extractBlock(
    source,
    /const ALLOWED_SHORTCUT_IDS: &\[&str\] = &\[([\s\S]*?)\];/,
    "backend shortcut ids block",
  );

  return [...block.matchAll(/"([a-z_]+)"/g)].map((match) => match[1]);
}

function collectDuplicates(keys: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const key of keys) {
    if (seen.has(key)) {
      duplicates.add(key);
    }
    seen.add(key);
  }

  return [...duplicates].sort();
}

const backendOnlyPreferenceKeys = ["selected_account_id"];

describe("preference contract", () => {
  it("keeps every frontend preference key allowed by the Tauri backend", () => {
    const frontendKeys = extractFrontendPreferenceKeys(frontendSource);
    const backendAllowedKeys = extractBackendAllowedKeys(backendSource);

    const missingInBackend = frontendKeys.filter(
      (key) => !backendAllowedKeys.includes(key),
    );

    expect(missingInBackend).toEqual([]);
  });

  it("keeps backend preference keys unique and limited to frontend or backend-only keys", () => {
    const frontendKeys = extractFrontendPreferenceKeys(frontendSource);
    const backendAllowedKeys = extractBackendAllowedKeys(backendSource);
    const allowedBackendKeys = new Set([
      ...frontendKeys,
      ...backendOnlyPreferenceKeys,
    ]);
    const unexpectedBackendKeys = backendAllowedKeys.filter(
      (key) => !allowedBackendKeys.has(key),
    );

    expect(collectDuplicates(backendAllowedKeys)).toEqual([]);
    expect(unexpectedBackendKeys).toEqual([]);
  });

  it("does not expose removed Inoreader preference keys", () => {
    const frontendKeys = extractFrontendPreferenceKeys(frontendSource);
    const backendAllowedKeys = extractBackendAllowedKeys(backendSource);

    expect(frontendKeys).not.toContain("inoreader_app_id");
    expect(frontendKeys).not.toContain("inoreader_app_key");
    expect(backendAllowedKeys).not.toContain("inoreader_app_id");
    expect(backendAllowedKeys).not.toContain("inoreader_app_key");
  });

  it("excludes hidden defaults while still resolving their fallback values", () => {
    expect(preferenceDefaults).not.toHaveProperty("sort_subscriptions");
    expect(resolvePreferenceValue({}, "sort_subscriptions")).toBe(
      "folders_first",
    );
    expect(
      resolvePreferenceValue(
        { sort_subscriptions: "unexpected" },
        "sort_subscriptions",
      ),
    ).toBe("folders_first");
  });

  it("keeps dynamic shortcut preference ids aligned with backend validation", () => {
    const frontendShortcutIds = extractShortcutDefinitionIds(
      keyboardShortcutsSource,
    );
    const backendShortcutIds = extractBackendAllowedShortcutIds(backendSource);

    expect(collectDuplicates(frontendShortcutIds)).toEqual([]);
    expect(collectDuplicates(backendShortcutIds)).toEqual([]);
    expect(backendShortcutIds).toEqual(frontendShortcutIds);
  });
});
