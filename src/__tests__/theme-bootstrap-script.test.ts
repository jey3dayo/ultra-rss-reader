import { beforeEach, describe, expect, it, vi } from "vitest";
import { STORAGE_KEYS } from "@/constants/storage";
import indexHtmlSource from "../../index.html?raw";

function extractThemeBootstrapScript(source: string): string {
  const match = source.match(/<script>\s*([\s\S]*?localStorage[\s\S]*?)\s*<\/script>/);
  if (!match) {
    throw new Error("Theme bootstrap script not found in index.html");
  }
  return match[1];
}

function runThemeBootstrapScript(): void {
  const script = extractThemeBootstrapScript(indexHtmlSource);
  new Function(script)();
}

function createMatchMedia(matches: boolean): typeof window.matchMedia {
  return vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as typeof window.matchMedia;
}

describe("index.html theme bootstrap script", () => {
  beforeEach(() => {
    document.documentElement.classList.remove("dark");
    document.documentElement.style.colorScheme = "";
    window.localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("reads the mirrored theme from localStorage and applies dark mode before app mount", () => {
    window.localStorage.setItem(STORAGE_KEYS.theme, "dark");
    const matchMedia = createMatchMedia(false);
    vi.stubGlobal("matchMedia", matchMedia);

    runThemeBootstrapScript();

    expect(document.documentElement).toHaveClass("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
    expect(matchMedia).not.toHaveBeenCalled();
  });

  it("uses prefers-color-scheme when the mirrored theme is system", () => {
    window.localStorage.setItem(STORAGE_KEYS.theme, "system");
    const matchMedia = createMatchMedia(true);
    vi.stubGlobal("matchMedia", matchMedia);

    runThemeBootstrapScript();

    expect(matchMedia).toHaveBeenCalledWith("(prefers-color-scheme: dark)");
    expect(document.documentElement).toHaveClass("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
  });
});
