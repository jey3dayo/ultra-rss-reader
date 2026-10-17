import { STORAGE_KEYS } from "@/constants/storage";
import {
  type FontSizePreference,
  type FontStylePreference,
  parseThemePreference,
  type Theme,
} from "@/schemas/preference-values";

export const objectHasOwnProperty = Object.prototype.hasOwnProperty;
export const preferenceStorageFailureMessages = new Set<string>();
export function logPreferenceRuntimeFailure(message: string, error: unknown): void {
  console.error(message, error);
}

function logPreferenceStorageFailureOnce(message: string, error: unknown): void {
  if (preferenceStorageFailureMessages.has(message)) {
    return;
  }

  preferenceStorageFailureMessages.add(message);
  logPreferenceRuntimeFailure(message, error);
}
export function getDocumentRoot(): HTMLElement | null {
  return typeof document === "undefined" ? null : document.documentElement;
}

export function getMediaQueryList(query: string): MediaQueryList | null {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return null;
  }

  try {
    return window.matchMedia(query);
  } catch (error) {
    logPreferenceRuntimeFailure(`Failed to query media preference ${query}:`, error);
    return null;
  }
}

export function getSystemPrefersDark(): boolean {
  return getMediaQueryList("(prefers-color-scheme: dark)")?.matches ?? false;
}

export function mirrorThemePreference(theme: Theme): void {
  try {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(STORAGE_KEYS.theme, theme);
  } catch (error) {
    // Storage mirroring is best-effort; DB remains the source of truth and optimistic UI state is retained.
    logPreferenceStorageFailureOnce("Failed to mirror theme preference:", error);
  }
}

export function readMirroredThemePreference(): Theme | null {
  try {
    if (typeof window === "undefined") {
      return null;
    }
    const storedTheme = window.localStorage.getItem(STORAGE_KEYS.theme);
    if (storedTheme === null) {
      return null;
    }
    return parseThemePreference(storedTheme);
  } catch (error) {
    logPreferenceStorageFailureOnce("Failed to read mirrored theme preference:", error);
    return null;
  }
}
export function getPrefersReducedMotion(): boolean {
  return getMediaQueryList("(prefers-reduced-motion: reduce)")?.matches ?? false;
}

export function updateResolvedTheme(root: HTMLElement, resolvedTheme: "light" | "dark"): void {
  root.classList.toggle("dark", resolvedTheme === "dark");
  root.style.colorScheme = resolvedTheme;
}
const fontStyleClasses = {
  sans_serif: "font-sans",
  monospace: "font-mono",
} satisfies Record<FontStylePreference, string>;

const fontSizeClasses = {
  small: "text-sm",
  medium: "text-base",
  large: "text-lg",
} satisfies Record<FontSizePreference, string>;

function isFontStylePreference(value: string): value is FontStylePreference {
  return objectHasOwnProperty.call(fontStyleClasses, value);
}

function isFontSizePreference(value: string): value is FontSizePreference {
  return objectHasOwnProperty.call(fontSizeClasses, value);
}

export function applyFontStyle(style: string): void {
  const root = getDocumentRoot();
  if (root === null) {
    return;
  }

  for (const cls of Object.values(fontStyleClasses)) {
    root.classList.remove(cls);
  }
  const cls = isFontStylePreference(style) ? fontStyleClasses[style] : fontStyleClasses.sans_serif;
  root.classList.add(cls);
}

export function applyFontSize(size: string): void {
  const root = getDocumentRoot();
  if (root === null) {
    return;
  }

  for (const cls of Object.values(fontSizeClasses)) {
    root.classList.remove(cls);
  }
  const cls = isFontSizePreference(size) ? fontSizeClasses[size] : fontSizeClasses.medium;
  root.classList.add(cls);
}
