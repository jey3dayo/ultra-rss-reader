import { describe, expect, it } from "vitest";
import { setStoryTauriRuntimeMissing, setStoryTauriRuntimePresent } from "@/components/storybook/story-tauri-runtime";

describe("story Tauri runtime helper", () => {
  it("keeps Tauri internals configurable when toggling story runtime state", () => {
    setStoryTauriRuntimePresent();

    expect(window.__TAURI_INTERNALS__).toEqual({});
    expect(Object.getOwnPropertyDescriptor(window, "__TAURI_INTERNALS__")).toMatchObject({
      configurable: true,
      writable: true,
      value: {},
    });

    setStoryTauriRuntimeMissing();

    expect(window.__TAURI_INTERNALS__).toBeUndefined();
    expect(Object.getOwnPropertyDescriptor(window, "__TAURI_INTERNALS__")).toMatchObject({
      configurable: true,
      writable: true,
      value: undefined,
    });

    setStoryTauriRuntimePresent();

    expect(window.__TAURI_INTERNALS__).toEqual({});
    expect(Object.getOwnPropertyDescriptor(window, "__TAURI_INTERNALS__")).toMatchObject({
      configurable: true,
      writable: true,
      value: {},
    });
  });
});
