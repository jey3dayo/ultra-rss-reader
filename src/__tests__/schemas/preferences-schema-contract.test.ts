import { describe, expect, expectTypeOf, it } from "vitest";
import keyboardShortcutsSource from "@/lib/keyboard/keyboard-shortcuts.ts?raw";
import {
  getLikelyPreferenceKeyTypo,
  getPreferenceValueSchema,
  type HiddenPreferenceKey,
  isRetiredBackendPassthroughPreferenceKey,
  normalizePreferenceRecord,
  normalizePreferenceValue,
  type PreferenceDefaultsRecord,
  preferenceDefaults,
  resolvePreferenceValue,
  type VisiblePreferenceDefaultKey,
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
  const block = extractBlock(source, /const preferenceSchemas = \{([\s\S]*?)\};/, "frontend preferenceSchemas block");

  return [...block.matchAll(/^\s*([a-z_]+):/gm)].map((match) => match[1]);
}

function extractBackendAllowedKeys(source: string): string[] {
  const block = extractBlock(source, /const ALLOWED_KEYS: &\[&str\] = &\[([\s\S]*?)\];/, "backend ALLOWED_KEYS block");

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

const afterReadingStoredValueCases = [
  { stored: "mark_as_read", normalized: "immediately" },
  { stored: "do_nothing", normalized: "never" },
  { stored: "archive", normalized: "never" },
  { stored: "never", normalized: "never" },
  { stored: "immediately", normalized: "immediately" },
  { stored: "after_0_3s", normalized: "after_0_3s" },
  { stored: "after_0_5s", normalized: "after_0_5s" },
  { stored: "after_1s", normalized: "after_1s" },
] as const;

describe("preference contract", () => {
  it("keeps every frontend preference key allowed by the Tauri backend", () => {
    const frontendKeys = extractFrontendPreferenceKeys(frontendSource);
    const backendAllowedKeys = extractBackendAllowedKeys(backendSource);

    const missingInBackend = frontendKeys.filter((key) => !backendAllowedKeys.includes(key));

    expect(missingInBackend).toEqual([]);
  });

  it("keeps backend preference keys unique and limited to frontend or backend-only keys", () => {
    const frontendKeys = extractFrontendPreferenceKeys(frontendSource);
    const backendAllowedKeys = extractBackendAllowedKeys(backendSource);
    const allowedBackendKeys = new Set([...frontendKeys, ...backendOnlyPreferenceKeys]);
    const unexpectedBackendKeys = backendAllowedKeys.filter((key) => !allowedBackendKeys.has(key));

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
    expect(resolvePreferenceValue({}, "sort_subscriptions")).toBe("folders_first");
    expect(resolvePreferenceValue({ sort_subscriptions: "unexpected" }, "sort_subscriptions")).toBe("folders_first");
  });

  it("keeps visible, hidden, and shortcut default key types separated", () => {
    expectTypeOf<HiddenPreferenceKey>().toEqualTypeOf<"sort_subscriptions">();
    expectTypeOf<Extract<VisiblePreferenceDefaultKey, "sort_subscriptions">>().toEqualTypeOf<never>();
    expectTypeOf<Extract<VisiblePreferenceDefaultKey, "after_reading">>().toEqualTypeOf<"after_reading">();
    expectTypeOf<
      Extract<VisiblePreferenceDefaultKey, "shortcut_next_article">
    >().toEqualTypeOf<"shortcut_next_article">();
    expectTypeOf<Extract<keyof PreferenceDefaultsRecord, "selected_account_id">>().toEqualTypeOf<never>();
  });

  it("keeps after-reading defaults and stored-value migrations parse compatible", () => {
    const afterReadingSchema = getPreferenceValueSchema("after_reading");

    expect(preferenceDefaults.after_reading).toBe("after_0_3s");
    expect(resolvePreferenceValue({}, "after_reading")).toBe("after_0_3s");
    expect(resolvePreferenceValue({ after_reading: "unexpected" }, "after_reading")).toBe("after_0_3s");

    for (const { stored, normalized } of afterReadingStoredValueCases) {
      expect(normalizePreferenceValue("after_reading", stored)).toBe(normalized);
      expect(resolvePreferenceValue({ after_reading: stored }, "after_reading")).toBe(normalized);
      expect(afterReadingSchema?.safeParse(normalized).success).toBe(true);
    }
  });

  it("normalizes known, shortcut, and unknown preference values at the frontend boundary", () => {
    expect(normalizePreferenceValue("theme", "dark")).toBe("dark");
    expect(normalizePreferenceValue("theme", "sepia")).toBe("light");
    expect(normalizePreferenceValue("debug_web_preview_url", "")).toBe("");
    expect(normalizePreferenceValue("custom_backend_preference", "  preserved  ")).toBe("  preserved  ");
    expect(normalizePreferenceValue("shortcut_next_article", " Shift+J ")).toBe("Shift+J");
    expect(normalizePreferenceValue("shortcut_next_article", "   ")).toBe(preferenceDefaults.shortcut_next_article);

    expect(
      normalizePreferenceRecord({
        theme: "sepia",
        shortcut_next_article: " Shift+J ",
        custom_backend_preference: "  preserved  ",
      }),
    ).toEqual({
      theme: "light",
      shortcut_next_article: "Shift+J",
      custom_backend_preference: "  preserved  ",
    });
  });

  it("classifies likely unknown passthrough typos without rejecting backend-owned keys", () => {
    expect(getLikelyPreferenceKeyTypo("them")).toBe("theme");
    expect(getLikelyPreferenceKeyTypo("shortcut_next_articl")).toBe("shortcut_next_article");
    expect(getLikelyPreferenceKeyTypo("selected_account_id")).toBeNull();
    expect(getLikelyPreferenceKeyTypo("custom_backend_preference")).toBeNull();
    expect(isRetiredBackendPassthroughPreferenceKey("custom_backend_preference")).toBe(false);
  });

  it("keeps dynamic shortcut preference ids aligned with backend validation", () => {
    const frontendShortcutIds = extractShortcutDefinitionIds(keyboardShortcutsSource);
    const backendShortcutIds = extractBackendAllowedShortcutIds(backendSource);

    expect(collectDuplicates(frontendShortcutIds)).toEqual([]);
    expect(collectDuplicates(backendShortcutIds)).toEqual([]);
    expect(backendShortcutIds).toEqual(frontendShortcutIds);
  });
});
