import { beforeEach, describe, expect, it } from "vitest";
import { resolvePreferenceValue, usePreferencesStore } from "../../stores/preferences-store";

describe("usePreferencesStore preferences", () => {
  beforeEach(() => {
    usePreferencesStore.setState({ prefs: {}, loaded: false });
  });

  it("falls back to the default theme when the persisted value is invalid", () => {
    usePreferencesStore.setState({ prefs: { theme: "midnight" }, loaded: true });

    expect(resolvePreferenceValue(usePreferencesStore.getState().prefs, "theme")).toBe("dark");
    expect(usePreferencesStore.getState().theme()).toBe("dark");
  });

  it("defaults reader and web preview preferences independently", () => {
    expect(resolvePreferenceValue({}, "reader_mode_default")).toBe("true");
    expect(resolvePreferenceValue({}, "web_preview_mode_default")).toBe("false");
  });

  it("normalizes invalid reader and web preview defaults", () => {
    expect(resolvePreferenceValue({ reader_mode_default: "maybe" }, "reader_mode_default")).toBe("true");
    expect(resolvePreferenceValue({ web_preview_mode_default: "sometimes" }, "web_preview_mode_default")).toBe("false");
  });

  it("defaults sidebar section visibility preferences to true", () => {
    expect(resolvePreferenceValue({}, "show_sidebar_unread")).toBe("true");
    expect(resolvePreferenceValue({}, "show_sidebar_starred")).toBe("true");
    expect(resolvePreferenceValue({}, "show_sidebar_tags")).toBe("true");
  });

  it("normalizes invalid sidebar visibility preferences back to true", () => {
    expect(resolvePreferenceValue({ show_sidebar_unread: "maybe" }, "show_sidebar_unread")).toBe("true");
    expect(resolvePreferenceValue({ show_sidebar_starred: "nope" }, "show_sidebar_starred")).toBe("true");
    expect(resolvePreferenceValue({ show_sidebar_tags: "unset" }, "show_sidebar_tags")).toBe("true");
  });
});
