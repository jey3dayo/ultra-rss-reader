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

  it("normalizes legacy reader view values and falls back for invalid ones", () => {
    expect(resolvePreferenceValue({ reader_view: "on" }, "reader_view")).toBe("widescreen");
    expect(resolvePreferenceValue({ reader_view: "off" }, "reader_view")).toBe("normal");
    expect(resolvePreferenceValue({ reader_view: "auto" }, "reader_view")).toBe("normal");
    expect(resolvePreferenceValue({ reader_view: "cinema" }, "reader_view")).toBe("normal");
  });
});
