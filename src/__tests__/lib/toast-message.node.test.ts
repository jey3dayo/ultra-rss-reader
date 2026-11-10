import { afterEach, describe, expect, it, vi } from "vitest";
import { segmentToastMessage } from "@/lib/ui/toast-message";

describe("segmentToastMessage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("segments Japanese toast copy with Japanese word boundaries regardless of app locale", () => {
    const message = "アップデートを適用して再起動しています…";
    const segments = segmentToastMessage(message, "en");

    expect(segments).not.toBeNull();
    expect(segments?.length).toBeGreaterThan(1);
    expect(segments?.join("")).toBe(message);
  });

  it("returns null when Intl.Segmenter is unavailable so callers can render plain text", () => {
    vi.stubGlobal("Intl", { Segmenter: undefined });

    expect(segmentToastMessage("アップデートを適用", "ja")).toBeNull();
  });
});
