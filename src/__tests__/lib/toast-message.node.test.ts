import { afterEach, describe, expect, it, vi } from "vitest";

describe("segmentToastMessage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("segments Japanese toast copy with Japanese word boundaries regardless of app locale", async () => {
    const message = "アップデートを適用して再起動しています…";
    const NativeSegmenter = Intl.Segmenter;
    const Segmenter = vi.fn(class extends NativeSegmenter {});
    vi.stubGlobal("Intl", { Segmenter });
    vi.resetModules();

    const { segmentToastMessage } = await import("@/lib/ui/toast-message");

    const segments = segmentToastMessage(message, "en");
    segmentToastMessage(message, "en");

    expect(segments).not.toBeNull();
    expect(segments?.length).toBeGreaterThan(1);
    expect(segments?.join("")).toBe(message);
    expect(Segmenter).toHaveBeenCalledTimes(2);
    expect(Segmenter).toHaveBeenCalledWith("ja", { granularity: "word" });
  });

  it("returns null when Intl.Segmenter is unavailable so callers can render plain text", async () => {
    vi.stubGlobal("Intl", { Segmenter: undefined });
    vi.resetModules();

    const { segmentToastMessage } = await import("@/lib/ui/toast-message");

    expect(segmentToastMessage("アップデートを適用", "ja")).toBeNull();
  });
});
