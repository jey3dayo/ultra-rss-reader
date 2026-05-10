import { expectSortedKeysForTarget } from "@tests/helpers/repo-contract-parser";
import { settingsPreferenceLabelKeys } from "@tests/helpers/settings-fixtures";
import { describe, expect, expectTypeOf, it } from "vitest";
import { PreferencesDtoSchema } from "@/api/schemas/preferences";
import keyboardShortcutsSource from "@/lib/keyboard/keyboard-shortcuts.ts?raw";
import enSettings from "@/locales/en/settings.json";
import jaSettings from "@/locales/ja/settings.json";
import {
  backendOwnedPreferenceKeys,
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
import backendSource from "../../../src-tauri/src/domain/preference.rs?raw";

function extractBlock(source: string, pattern: RegExp, label: string): string {
  const matched = source.match(pattern)?.[1];
  if (!matched) {
    throw new Error(`Could not find ${label}`);
  }
  return matched;
}

function hasOwnKey(value: object, key: string): boolean {
  return Reflect.getOwnPropertyDescriptor(value, key) !== undefined;
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

  return [...duplicates].toSorted();
}

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
    const allowedBackendKeys = new Set([...frontendKeys, ...backendOwnedPreferenceKeys]);
    const unexpectedBackendKeys = backendAllowedKeys.filter((key) => !allowedBackendKeys.has(key));

    expect(collectDuplicates(backendAllowedKeys)).toEqual([]);
    expect(unexpectedBackendKeys).toEqual([]);
  });

  it("keeps backend preference allowlist exactly aligned with frontend schema plus backend-owned keys", () => {
    const frontendKeys = extractFrontendPreferenceKeys(frontendSource);
    const backendAllowedKeys = extractBackendAllowedKeys(backendSource);

    expect(backendAllowedKeys.toSorted()).toEqual([...frontendKeys, ...backendOwnedPreferenceKeys].toSorted());
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
    expectTypeOf<HiddenPreferenceKey>().toEqualTypeOf<"sort_subscriptions" | "action_open_browser">();
    expectTypeOf<Extract<VisiblePreferenceDefaultKey, "sort_subscriptions">>().toEqualTypeOf<never>();
    expectTypeOf<Extract<VisiblePreferenceDefaultKey, "action_open_browser">>().toEqualTypeOf<never>();
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

  it("keeps app default and current preference values accepted by the API DTO schema", () => {
    const currentPreferenceValues = {
      ...preferenceDefaults,
      selected_account_id: "account-1",
      sort_subscriptions: resolvePreferenceValue({}, "sort_subscriptions"),
      action_open_browser: resolvePreferenceValue({}, "action_open_browser"),
      after_reading: normalizePreferenceValue("after_reading", "mark_as_read"),
    };

    expect(PreferencesDtoSchema.parse(currentPreferenceValues)).toEqual(currentPreferenceValues);
    expect(PreferencesDtoSchema.parse({ custom_backend_preference: "preserved" })).toEqual({
      custom_backend_preference: "preserved",
    });
    expect(PreferencesDtoSchema.safeParse({ theme: "midnight" }).success).toBe(false);
    expect(PreferencesDtoSchema.safeParse({ after_reading: "mark_as_read" }).success).toBe(false);
    expect(PreferencesDtoSchema.safeParse({ shortcut_unknown_action: "Shift+X" }).success).toBe(false);
  });

  it("normalizes preference records into prototype-pollution-safe passthrough output", () => {
    const normalized = normalizePreferenceRecord({
      theme: "dark",
      ["__proto__"]: "polluted",
      constructor: "preserved",
    });

    expect(Object.getPrototypeOf(normalized)).toBeNull();
    expect(Object.getOwnPropertyDescriptor(normalized, "__proto__")).toMatchObject({
      enumerable: true,
      value: "polluted",
    });
    expect(normalized.theme).toBe("dark");
    expect(normalized.__proto__).toBe("polluted");
    expect(normalized.constructor).toBe("preserved");
    expect(Object.prototype).not.toHaveProperty("polluted");
  });

  it("keeps key-specific freeform preference string limits and control-character policy stable", () => {
    const selectedAccountIdSchema = getPreferenceValueSchema("selected_account_id");
    const debugWebPreviewUrlSchema = getPreferenceValueSchema("debug_web_preview_url");
    const shortcutSchema = getPreferenceValueSchema("shortcut_next_article");

    expect(selectedAccountIdSchema?.safeParse(" account-1 ").data).toBe("account-1");
    expect(selectedAccountIdSchema?.safeParse("a".repeat(256)).success).toBe(true);
    expect(selectedAccountIdSchema?.safeParse("a".repeat(257)).success).toBe(false);
    expect(selectedAccountIdSchema?.safeParse("account\n1").success).toBe(false);
    expect(normalizePreferenceValue("selected_account_id", " account-1 ")).toBe("account-1");
    expect(normalizePreferenceValue("selected_account_id", "account\n1")).toBe("");

    expect(debugWebPreviewUrlSchema?.safeParse("https://example.com/path?q=1").success).toBe(true);
    expect(debugWebPreviewUrlSchema?.safeParse("a".repeat(1024)).success).toBe(true);
    expect(debugWebPreviewUrlSchema?.safeParse("a".repeat(1025)).success).toBe(false);
    expect(debugWebPreviewUrlSchema?.safeParse("https://example.com/\u0000").success).toBe(false);
    expect(debugWebPreviewUrlSchema?.safeParse("https://example.com/\u0085").success).toBe(false);
    expect(normalizePreferenceValue("debug_web_preview_url", "a".repeat(1025))).toBe("");

    expect(shortcutSchema?.safeParse(" Shift+J ").data).toBe("Shift+J");
    expect(shortcutSchema?.safeParse("a".repeat(128)).success).toBe(true);
    expect(shortcutSchema?.safeParse("a".repeat(129)).success).toBe(false);
    expect(shortcutSchema?.safeParse("Shift+\nJ").success).toBe(false);
    expect(shortcutSchema?.safeParse("Shift+\u009fJ").success).toBe(false);
  });

  it("classifies likely unknown passthrough typos without rejecting backend-owned keys", () => {
    expect(getLikelyPreferenceKeyTypo("them")).toBe("theme");
    expect(getLikelyPreferenceKeyTypo("shortcut_next_articl")).toBe("shortcut_next_article");
    expect(getLikelyPreferenceKeyTypo("selected_account_id")).toBeNull();
    expect(getLikelyPreferenceKeyTypo("custom_backend_preference")).toBeNull();
    expect(isRetiredBackendPassthroughPreferenceKey("custom_backend_preference")).toBe(false);
  });

  it("keeps typo suggestions bounded by edit-distance cost as preference key sets grow", () => {
    expect(getLikelyPreferenceKeyTypo("show_sidebar_recent_article")).toBe("show_sidebar_recent_articles");
    expect(getLikelyPreferenceKeyTypo("shortcut_prev_articl")).toBe("shortcut_prev_article");
    expect(getLikelyPreferenceKeyTypo(`theme_${"x".repeat(123)}`)).toBeNull();
    expect(getLikelyPreferenceKeyTypo(`theme_${"x".repeat(128)}`)).toBeNull();
  });

  it("keeps preference typo diagnostics locale-independent for reserved, long, and CJK keys", () => {
    expect(getLikelyPreferenceKeyTypo("shortcut_")).toBeNull();
    expect(getLikelyPreferenceKeyTypo("shortcut_next_article")).toBeNull();
    expect(getLikelyPreferenceKeyTypo("selected_account_i")).toBe("selected_account_id");
    expect(getLikelyPreferenceKeyTypo("action_open_browse")).toBe("action_open_browser");
    expect(getLikelyPreferenceKeyTypo("テーマ")).toBeNull();
    expect(getLikelyPreferenceKeyTypo("テーマ_theme")).toBeNull();
    expect(getLikelyPreferenceKeyTypo("x".repeat(512))).toBeNull();
  });

  it("keeps dynamic shortcut preference ids aligned with backend validation", () => {
    const frontendShortcutIds = extractShortcutDefinitionIds(keyboardShortcutsSource);
    const backendShortcutIds = extractBackendAllowedShortcutIds(backendSource);

    expect(collectDuplicates(frontendShortcutIds)).toEqual([]);
    expect(collectDuplicates(backendShortcutIds)).toEqual([]);
    expect(backendShortcutIds).toEqual(frontendShortcutIds);
  });

  it("keeps visible preference defaults covered by settings locale labels", () => {
    const localeSettings = [enSettings, jaSettings];
    const nonShortcutDefaultKeys = Object.keys(preferenceDefaults).filter(
      (key): key is Exclude<VisiblePreferenceDefaultKey, `shortcut_${string}`> => !key.startsWith("shortcut_"),
    );

    expectSortedKeysForTarget(
      "visible preference defaults vs settings locale label keys",
      nonShortcutDefaultKeys,
      Object.keys(settingsPreferenceLabelKeys),
    );
    for (const labelKey of Object.values(settingsPreferenceLabelKeys)) {
      const path = labelKey.split(".");
      for (const settings of localeSettings) {
        let value: unknown = settings;
        for (const segment of path) {
          value =
            typeof value === "object" && value !== null && hasOwnKey(value, segment)
              ? value[segment as keyof typeof value]
              : undefined;
        }
        expect(typeof value === "string" && value.length > 0, `${labelKey} should exist`).toBe(true);
      }
    }
  });
});
