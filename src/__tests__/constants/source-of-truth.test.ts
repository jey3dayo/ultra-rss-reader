import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, expectTypeOf, it } from "vitest";
import { PlatformInfoSchema } from "@/api/schemas";
import {
  BROWSER_SURFACE_ISSUE_KINDS,
  BROWSER_WINDOW_EVENTS,
  type BrowserSurfaceIssueKind,
  type BrowserWindowEventName,
} from "@/constants/browser";
import { APP_EVENTS, type AppEventName } from "@/constants/events";
import {
  MOTION_CLASS_NAMES,
  MOTION_DATA_ATTRIBUTES,
  MOTION_GLOBAL_CSS_CONTRACT_SELECTORS,
  MOTION_KEYFRAMES_NAMES,
  MOTION_TRANSITION_TOKEN_DECLARATIONS,
  type MotionClassName,
  type MotionDataAttribute,
  type MotionGlobalCssContractSelector,
  type MotionKeyframesName,
  type MotionTransitionTokenDeclaration,
} from "@/constants/motion";
import {
  DEFAULT_PLATFORM_CAPABILITIES,
  type DEFAULT_PLATFORM_INFO,
  type DefaultPlatformInfo,
  PLATFORM_KINDS,
  type PlatformCapabilities,
  type PlatformCapabilityDefault,
  type PlatformCapabilityName,
  type PlatformKind,
  SHORTCUT_MODIFIER_BY_PLATFORM,
} from "@/constants/platform";
import {
  LEGACY_STORAGE_KEYS,
  type LegacyStorageKey,
  STORAGE_KEY_POLICIES,
  STORAGE_KEYS,
  type StorageKey,
  type StorageKeyName,
} from "@/constants/storage";

function expectNoDuplicates(values: readonly string[]) {
  expect(new Set(values).size).toBe(values.length);
}

const globalCss = readFileSync(join(process.cwd(), "src/styles/global.css"), "utf8");

describe("constants source of truth", () => {
  it("derives app event names from APP_EVENTS", () => {
    const eventNames = Object.values(APP_EVENTS);

    expectNoDuplicates(eventNames);
    expectTypeOf<AppEventName>().toEqualTypeOf<(typeof eventNames)[number]>();
  });

  it("derives browser window event names from BROWSER_WINDOW_EVENTS", () => {
    const eventNames = Object.values(BROWSER_WINDOW_EVENTS);

    expectNoDuplicates(eventNames);
    expectTypeOf<BrowserWindowEventName>().toEqualTypeOf<(typeof eventNames)[number]>();
  });

  it("derives browser surface issue kinds from BROWSER_SURFACE_ISSUE_KINDS", () => {
    expectNoDuplicates(BROWSER_SURFACE_ISSUE_KINDS);
    expectTypeOf<BrowserSurfaceIssueKind>().toEqualTypeOf<(typeof BROWSER_SURFACE_ISSUE_KINDS)[number]>();
  });

  it("derives storage keys from STORAGE_KEYS while keeping legacy keys separate", () => {
    const storageKeys = Object.values(STORAGE_KEYS);
    const legacyStorageKeys = Object.values(LEGACY_STORAGE_KEYS);

    expectNoDuplicates(storageKeys);
    expect(storageKeys.every((key) => key.startsWith("ultra-rss:"))).toBe(true);
    expect(storageKeys.some((key) => (legacyStorageKeys as readonly string[]).includes(key))).toBe(false);
    expectTypeOf<StorageKey>().toEqualTypeOf<(typeof storageKeys)[number]>();
    expectTypeOf<LegacyStorageKey>().toEqualTypeOf<(typeof legacyStorageKeys)[number]>();
  });

  it("classifies storage keys as runtime tokens with explicit policies", () => {
    expect(Object.keys(STORAGE_KEY_POLICIES)).toEqual(Object.keys(STORAGE_KEYS));
    expectTypeOf<keyof typeof STORAGE_KEY_POLICIES>().toEqualTypeOf<StorageKeyName>();
  });

  it("classifies motion constants as design tokens", () => {
    expectNoDuplicates(MOTION_CLASS_NAMES);
    expectNoDuplicates(MOTION_KEYFRAMES_NAMES);
    expectNoDuplicates(MOTION_DATA_ATTRIBUTES);
    expectNoDuplicates(MOTION_GLOBAL_CSS_CONTRACT_SELECTORS);
    expectNoDuplicates(MOTION_TRANSITION_TOKEN_DECLARATIONS);
    expectTypeOf<MotionClassName>().toEqualTypeOf<(typeof MOTION_CLASS_NAMES)[number]>();
    expectTypeOf<MotionKeyframesName>().toEqualTypeOf<(typeof MOTION_KEYFRAMES_NAMES)[number]>();
    expectTypeOf<MotionDataAttribute>().toEqualTypeOf<(typeof MOTION_DATA_ATTRIBUTES)[number]>();
    expectTypeOf<MotionGlobalCssContractSelector>().toEqualTypeOf<
      (typeof MOTION_GLOBAL_CSS_CONTRACT_SELECTORS)[number]
    >();
    expectTypeOf<MotionTransitionTokenDeclaration>().toEqualTypeOf<
      (typeof MOTION_TRANSITION_TOKEN_DECLARATIONS)[number]
    >();
  });

  it("keeps motion transition token declarations aligned with global CSS", () => {
    for (const tokenDeclaration of MOTION_TRANSITION_TOKEN_DECLARATIONS) {
      expect(globalCss).toContain(tokenDeclaration);
    }
  });

  it("uses platform constants as the platform-kind and capability source of truth", () => {
    expect(PlatformInfoSchema.parse({ kind: "macos", capabilities: DEFAULT_PLATFORM_CAPABILITIES }).kind).toBe("macos");
    expect(() => PlatformInfoSchema.parse({ kind: "ios", capabilities: DEFAULT_PLATFORM_CAPABILITIES })).toThrowError();
    expect(Object.keys(SHORTCUT_MODIFIER_BY_PLATFORM)).toEqual([...PLATFORM_KINDS]);
    expect(Object.keys(DEFAULT_PLATFORM_CAPABILITIES)).toEqual([
      "supports_reading_list",
      "supports_background_browser_open",
      "supports_runtime_window_icon_replacement",
      "supports_native_browser_navigation",
      "uses_dev_file_credentials",
    ]);
    expectTypeOf<PlatformKind>().toEqualTypeOf<(typeof PLATFORM_KINDS)[number]>();
    expectTypeOf<PlatformCapabilityName>().toEqualTypeOf<keyof typeof DEFAULT_PLATFORM_CAPABILITIES>();
    expectTypeOf<PlatformCapabilities>().toEqualTypeOf<typeof DEFAULT_PLATFORM_CAPABILITIES>();
    expectTypeOf<PlatformCapabilityDefault>().toEqualTypeOf<
      (typeof DEFAULT_PLATFORM_CAPABILITIES)[PlatformCapabilityName]
    >();
    expectTypeOf<DefaultPlatformInfo>().toEqualTypeOf<typeof DEFAULT_PLATFORM_INFO>();
  });
});
