import { Result } from "@praha/byethrow";
import { describe, expect, it } from "vitest";
import {
  buildKeyToActionMap,
  formatKeyForDisplay,
  keyboardEvents,
  resolveKeyboardAction,
} from "@/lib/keyboard-shortcuts";

describe("keyboard shortcut resolver", () => {
  it("opens settings on command comma even when an input is focused", () => {
    const result = resolveKeyboardAction({
      key: ",",
      metaKey: true,
      ctrlKey: false,
      shiftKey: false,
      targetTag: "INPUT",
      selectedArticleId: null,
      contentMode: "empty",
      viewMode: "all",
    });

    expect(Result.unwrap(result)).toEqual({ type: "open-settings" });
  });

  it("resolves Cmd+K to open-command-palette", () => {
    const result = resolveKeyboardAction({
      key: "k",
      metaKey: true,
      ctrlKey: false,
      shiftKey: false,
      targetTag: "DIV",
      selectedArticleId: null,
      contentMode: "empty",
      viewMode: "all",
    });

    expect(Result.unwrap(result)).toEqual({ type: "open-command-palette" });
  });

  it("resolves h to navigate-feed backward", () => {
    const result = resolveKeyboardAction({
      key: "h",
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      targetTag: "DIV",
      selectedArticleId: null,
      contentMode: "empty",
      viewMode: "all",
    });

    expect(Result.unwrap(result)).toEqual({ type: "navigate-feed", direction: -1 });
  });

  it("resolves l to navigate-feed forward", () => {
    const result = resolveKeyboardAction({
      key: "l",
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      targetTag: "DIV",
      selectedArticleId: null,
      contentMode: "empty",
      viewMode: "all",
    });

    expect(Result.unwrap(result)).toEqual({ type: "navigate-feed", direction: 1 });
  });

  it("ignores shortcuts when a text input is focused", () => {
    const result = resolveKeyboardAction({
      key: "m",
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      targetTag: "TEXTAREA",
      selectedArticleId: "art-1",
      contentMode: "reader",
      viewMode: "all",
    });

    expect(Result.unwrapError(result)).toBe("ignored_input");
  });

  it("emits toggle-read for m when an article is selected", () => {
    const result = resolveKeyboardAction({
      key: "m",
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      targetTag: "DIV",
      selectedArticleId: "art-1",
      contentMode: "reader",
      viewMode: "all",
    });

    expect(Result.unwrap(result)).toEqual({ type: "emit", eventName: keyboardEvents.toggleRead });
  });

  it("cycles the view mode for f", () => {
    const result = resolveKeyboardAction({
      key: "f",
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      targetTag: "DIV",
      selectedArticleId: null,
      contentMode: "empty",
      viewMode: "unread",
    });

    expect(Result.unwrap(result)).toEqual({ type: "set-view-mode", mode: "starred" });
  });

  it("closes the browser on escape when browser mode is active", () => {
    const result = resolveKeyboardAction({
      key: "Escape",
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      targetTag: "DIV",
      selectedArticleId: "art-1",
      contentMode: "browser",
      viewMode: "all",
    });

    expect(Result.unwrap(result)).toEqual({ type: "close-browser" });
  });

  it("clears the selected article on escape in reader mode", () => {
    const result = resolveKeyboardAction({
      key: "Escape",
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      targetTag: "DIV",
      selectedArticleId: "art-1",
      contentMode: "reader",
      viewMode: "all",
    });

    expect(Result.unwrap(result)).toEqual({ type: "clear-article" });
  });

  it("formats modifier shortcuts for macOS display", () => {
    expect(formatKeyForDisplay("⌘+k", "macos")).toBe("⌘ k");
    expect(formatKeyForDisplay("⌘,", "macos")).toBe("⌘ ,");
  });

  it("formats modifier shortcuts for Windows display", () => {
    expect(formatKeyForDisplay("⌘+k", "windows")).toBe("Ctrl k");
    expect(formatKeyForDisplay("⌘,", "windows")).toBe("Ctrl ,");
  });

  it("builds h/l as the default feed navigation bindings", () => {
    const map = buildKeyToActionMap({});

    expect(map.get("h")).toBe("prev_feed");
    expect(map.get("l")).toBe("next_feed");
  });
});
