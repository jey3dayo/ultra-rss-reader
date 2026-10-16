import { type PlatformKind, SHORTCUT_MODIFIER_BY_PLATFORM } from "@/constants/platform";
import type { ShortcutKeyEvent, ShortcutModifierEvent } from "./keyboard-shortcut-model";

export function normalizeModifierToken(token: string): string {
  return /^(?:cmdorctrl|command|cmd|control|ctrl)$/i.test(token) ? "\u2318" : token;
}

export function normalizeShortcutKeyForContract(key: string): string {
  const compactKey = key.trim().replace(/\s*\+\s*/g, "+");
  if (compactKey.length === 0) {
    return "";
  }

  const parts =
    !compactKey.includes("+") && compactKey.startsWith("\u2318") && compactKey.length > 1
      ? ["\u2318", compactKey.slice(1)]
      : compactKey.includes("+")
        ? compactKey.split("+")
        : [compactKey];
  return parts
    .map((part) => {
      const normalizedPart = normalizeModifierToken(part);
      return normalizedPart.length === 1 && normalizedPart.toLocaleUpperCase() !== normalizedPart.toLocaleLowerCase()
        ? normalizedPart.toLocaleLowerCase()
        : normalizedPart;
    })
    .join("+");
}

export function normalizeShortcutMapKey(key: string): string | null {
  const trimmedKey = key.trim();
  return trimmedKey.length > 0 ? normalizeShortcutKeyForContract(trimmedKey) : null;
}

export function normalizeRecordedShortcutKey(e: {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
}): string {
  return normalizeShortcutKeyForContract(normalizeKeyFromEvent(e));
}
export function isPrimaryModifierActive(platformKind: PlatformKind, e: ShortcutModifierEvent): boolean {
  return platformKind === "macos" ? e.metaKey : e.ctrlKey;
}

export function hasNonPrimaryModifier(platformKind: PlatformKind, e: ShortcutModifierEvent): boolean {
  return (platformKind === "macos" && e.ctrlKey) || (platformKind !== "macos" && e.metaKey);
}

export const SPACE_KEY_TOKEN = "Space";

export function normalizeKeyToken(key: string, shiftKey: boolean): string {
  if (key === " ") {
    return SPACE_KEY_TOKEN;
  }
  return key.length === 1 && shiftKey ? key.toUpperCase() : key;
}

/** Normalize a KeyboardEvent into the key string format used in shortcut definitions. */
export function normalizeKeyFromEvent(e: ShortcutKeyEvent): string {
  const parts: string[] = [];
  if (e.metaKey || e.ctrlKey) parts.push("\u2318");
  if (e.shiftKey && e.key !== "Shift") parts.push("Shift");
  parts.push(normalizeKeyToken(e.key, e.shiftKey));
  return parts.join("+");
}

export function normalizeKeyFromRuntimeEvent(e: ShortcutKeyEvent, platformKind: PlatformKind): string {
  const parts: string[] = [];
  if (isPrimaryModifierActive(platformKind, e)) {
    parts.push("\u2318");
  } else if (e.metaKey) {
    parts.push("Meta");
  } else if (e.ctrlKey) {
    parts.push("Ctrl");
  }
  if (e.shiftKey && e.key !== "Shift") parts.push("Shift");
  parts.push(normalizeKeyToken(e.key, e.shiftKey));
  return parts.join("+");
}

/** Display-friendly format: "Shift+R" -> "Shift + R", "⌘," -> "⌘ ," */
export function formatKeyForDisplay(key: string, platformKind: PlatformKind): string {
  const modifier = SHORTCUT_MODIFIER_BY_PLATFORM[platformKind];
  const normalized = key.replace(/\u2318/g, modifier).replace(/\+/g, " + ");
  const modifierPattern = platformKind === "macos" ? /\u2318\s*\+?\s*/g : /Ctrl\s*\+?\s*/g;
  return normalized.replace(modifierPattern, `${modifier} `);
}

export function formatKeyAsNativeAccelerator(key: string): string {
  return normalizeShortcutKeyForContract(key)
    .replace(/\u2318/g, "CmdOrCtrl")
    .split("+")
    .map((part) =>
      part.length === 1 && part.toLocaleUpperCase() !== part.toLocaleLowerCase() ? part.toUpperCase() : part,
    )
    .join("+");
}
