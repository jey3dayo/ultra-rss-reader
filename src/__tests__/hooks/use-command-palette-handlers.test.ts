import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  translateCommandPaletteFallbackMessage,
  useCommandPaletteHandlers,
} from "@/components/reader/hooks/command-palette/use-command-palette-handlers";
import i18n from "@/lib/i18n";
import enReader from "@/locales/en/reader.json";

const { addToHistoryMock, executeActionMock, runRuntimeDevScenarioMock } = vi.hoisted(() => ({
  addToHistoryMock: vi.fn(),
  executeActionMock: vi.fn(),
  runRuntimeDevScenarioMock: vi.fn(),
}));

vi.mock("@/components/reader/hooks/command-palette/use-command-history", () => ({
  addToHistory: addToHistoryMock,
}));

vi.mock("@/lib/actions", () => ({
  executeAction: executeActionMock,
}));

vi.mock("@/dev/scenario-runtime", () => ({
  runRuntimeDevScenario: runRuntimeDevScenarioMock,
}));

afterEach(() => {
  vi.clearAllMocks();
  if (!i18n.hasResourceBundle("en", "reader")) {
    i18n.addResourceBundle("en", "reader", enReader, true, true);
  }
});

function createHandlers(overrides: Partial<Parameters<typeof useCommandPaletteHandlers>[0]> = {}) {
  const { result } = renderHook(() =>
    useCommandPaletteHandlers({
      closePalette: vi.fn(),
      openShortcutsHelp: vi.fn(),
      showToast: vi.fn(),
      selectedAccountId: "acc-1",
      isSyncing: false,
      selectFeedFromCurrentContext: vi.fn(),
      selectTagFromCurrentContext: vi.fn(),
      selectArticle: vi.fn(),
      openFeedLanding: vi.fn(),
      ...overrides,
    }),
  );
  return result.current;
}

describe("useCommandPaletteHandlers", () => {
  it("resolves bundled command palette fallback copy with interpolation and language fallback", () => {
    expect(
      translateCommandPaletteFallbackMessage("feed_landing_failed", "ja", {
        feedId: "feed-1",
        message: "boom",
      }),
    ).toBe('フィード "feed-1" を開けませんでした: boom');
    expect(
      translateCommandPaletteFallbackMessage("feed_landing_failed", "fr", {
        feedId: "feed-1",
        message: "boom",
      }),
    ).toBe('Failed to open feed "feed-1": boom');
  });

  it("opens shortcuts help without dispatching or writing command history", () => {
    const closePalette = vi.fn();
    const openShortcutsHelp = vi.fn();
    const handlers = createHandlers({ closePalette, openShortcutsHelp });

    handlers.handleActionSelect("open-shortcuts-help");

    expect(openShortcutsHelp).toHaveBeenCalledOnce();
    expect(closePalette).toHaveBeenCalledOnce();
    expect(addToHistoryMock).not.toHaveBeenCalled();
    expect(executeActionMock).not.toHaveBeenCalled();
  });

  it("uses a localized toast when a dev scenario fails", async () => {
    const showToast = vi.fn();
    const closePalette = vi.fn();
    runRuntimeDevScenarioMock.mockRejectedValueOnce(new Error("boom"));
    const handlers = createHandlers({ closePalette, showToast });

    handlers.handleDevScenarioSelect("open-add-feed-dialog");

    expect(closePalette).toHaveBeenCalledOnce();
    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith('Failed to run dev scenario "open-add-feed-dialog": boom');
    });
  });

  it("falls back to bundled command palette messages when locale resources return keys", async () => {
    const showToast = vi.fn();
    runRuntimeDevScenarioMock.mockRejectedValueOnce(new Error("boom"));
    i18n.removeResourceBundle("en", "reader");
    await i18n.changeLanguage("en");
    const handlers = createHandlers({ showToast });

    handlers.handleDevScenarioSelect("open-add-feed-dialog");

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith('Failed to run dev scenario "open-add-feed-dialog": boom');
    });
    expect(showToast).not.toHaveBeenCalledWith(expect.stringContaining("command_palette."));
  });
});
