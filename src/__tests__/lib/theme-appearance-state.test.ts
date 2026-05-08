import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { Result } from "@praha/byethrow";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STORAGE_KEYS } from "@/constants/storage";

const { getPreferencesMock, setPreferenceMock } = vi.hoisted(() => ({
  getPreferencesMock: vi.fn(),
  setPreferenceMock: vi.fn(),
}));

vi.mock("@/api/tauri-commands", () => ({
  getPreferences: getPreferencesMock,
  setPreference: setPreferenceMock,
}));

const bootstrapScript =
  readFileSync(join(process.cwd(), "index.html"), "utf8").match(/<script>\s*([\s\S]*?)\s*<\/script>/)?.[1] ?? "";

function setMatchMedia(prefersDark: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query === "(prefers-color-scheme: dark)" ? prefersDark : false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
}

function resetThemeDom() {
  document.documentElement.className = "";
  document.documentElement.removeAttribute("style");
}

function runBootstrap() {
  runInNewContext(bootstrapScript, { document, localStorage, window });
}

async function loadPreferencesStore(prefs: Record<string, string>) {
  vi.resetModules();
  getPreferencesMock.mockResolvedValue(Result.succeed(prefs));
  setPreferenceMock.mockResolvedValue(Result.succeed(undefined));

  const { usePreferencesStore } = await import("@/stores/preferences-store");
  await usePreferencesStore.getState().loadPreferences();
  return usePreferencesStore;
}

describe("theme bootstrap and appearance state", () => {
  beforeEach(() => {
    localStorage.clear();
    resetThemeDom();
    setMatchMedia(false);
    getPreferencesMock.mockReset();
    setPreferenceMock.mockReset();
  });

  afterEach(() => {
    localStorage.clear();
    resetThemeDom();
    vi.unstubAllGlobals();
  });

  it("applies persisted dark theme before React hydration", () => {
    localStorage.setItem(STORAGE_KEYS.theme, "dark");

    runBootstrap();

    expect(document.documentElement).toHaveClass("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
  });

  it("resolves system theme before React hydration from prefers-color-scheme", () => {
    localStorage.setItem(STORAGE_KEYS.theme, "system");
    setMatchMedia(true);

    runBootstrap();

    expect(document.documentElement).toHaveClass("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
  });

  it("falls back to light before React hydration for invalid stored theme", () => {
    localStorage.setItem(STORAGE_KEYS.theme, "sepia");
    setMatchMedia(true);

    runBootstrap();

    expect(document.documentElement).not.toHaveClass("dark");
    expect(document.documentElement.style.colorScheme).toBe("light");
  });

  it("hydrates missing store theme from mirrored system preference", async () => {
    localStorage.setItem(STORAGE_KEYS.theme, "system");
    setMatchMedia(true);

    const usePreferencesStore = await loadPreferencesStore({});

    expect(usePreferencesStore.getState().prefs.theme).toBe("system");
    expect(usePreferencesStore.getState().theme()).toBe("system");
    expect(document.documentElement).toHaveClass("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
  });

  it("uses command theme over mirrored theme during store hydration", async () => {
    localStorage.setItem(STORAGE_KEYS.theme, "system");
    setMatchMedia(true);

    const usePreferencesStore = await loadPreferencesStore({ theme: "light" });

    expect(usePreferencesStore.getState().prefs.theme).toBe("light");
    expect(localStorage.getItem(STORAGE_KEYS.theme)).toBe("light");
    expect(document.documentElement).not.toHaveClass("dark");
    expect(document.documentElement.style.colorScheme).toBe("light");
  });

  it("hydrates missing store theme to light when no valid persisted theme exists", async () => {
    localStorage.setItem(STORAGE_KEYS.theme, "sepia");
    setMatchMedia(true);

    const usePreferencesStore = await loadPreferencesStore({});

    expect(usePreferencesStore.getState().prefs.theme).toBe("light");
    expect(localStorage.getItem(STORAGE_KEYS.theme)).toBe("light");
    expect(document.documentElement).not.toHaveClass("dark");
    expect(document.documentElement.style.colorScheme).toBe("light");
  });
});
