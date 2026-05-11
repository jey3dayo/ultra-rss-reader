import { Result } from "@praha/byethrow";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  translateCommandPaletteFallbackMessage,
  useCommandPaletteHandlers,
} from "@/components/reader/hooks/command-palette/use-command-palette-handlers";
import i18n from "@/lib/i18n";
import enReader from "@/locales/en/reader.json";
import { useUiStore } from "@/stores/ui-store";

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
  useUiStore.setState(useUiStore.getInitialState());
  if (!i18n.hasResourceBundle("en", "reader")) {
    i18n.addResourceBundle("en", "reader", enReader, true, true);
  }
});

function createDeferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  let reject: (reason?: unknown) => void = () => undefined;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

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
      paletteSessionId: 1,
      commandPaletteOpen: true,
      canSelectArticle: () => true,
      ...overrides,
    }),
  );
  return result.current;
}

function renderHandlers(initialOverrides: Partial<Parameters<typeof useCommandPaletteHandlers>[0]> = {}) {
  return renderHook(
    ({ overrides }) =>
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
        paletteSessionId: 1,
        commandPaletteOpen: true,
        canSelectArticle: () => true,
        ...overrides,
      }),
    {
      initialProps: { overrides: initialOverrides },
    },
  );
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

  it("does not dispatch account-scoped actions from a stale account selection", () => {
    const { result, rerender } = renderHandlers({ selectedAccountId: "acc-1" });

    rerender({ overrides: { selectedAccountId: null } });
    result.current.handleActionSelect("sync-all");

    expect(addToHistoryMock).not.toHaveBeenCalled();
    expect(executeActionMock).not.toHaveBeenCalled();
  });

  it("does not dispatch actions after the palette has already closed", () => {
    const openShortcutsHelp = vi.fn();
    const { result, rerender } = renderHandlers({
      commandPaletteOpen: true,
      openShortcutsHelp,
    });
    const staleShortcutsHandler = result.current;

    rerender({ overrides: { commandPaletteOpen: false } });
    result.current.handleActionSelect("open-add-feed");
    staleShortcutsHandler.handleActionSelect("open-shortcuts-help");

    expect(addToHistoryMock).not.toHaveBeenCalled();
    expect(executeActionMock).not.toHaveBeenCalled();
    expect(openShortcutsHelp).not.toHaveBeenCalled();
  });

  it("guards action double submits within the same palette session", () => {
    const closePalette = vi.fn();
    const handlers = createHandlers({ closePalette });

    handlers.handleActionSelect("open-settings");
    handlers.handleActionSelect("open-settings");

    expect(addToHistoryMock).toHaveBeenCalledOnce();
    expect(executeActionMock).toHaveBeenCalledOnce();
    expect(executeActionMock).toHaveBeenCalledWith("open-settings");
    expect(closePalette).toHaveBeenCalledOnce();
  });

  it("guards resource double submits within the same palette session", () => {
    const closePalette = vi.fn();
    const selectTagFromCurrentContext = vi.fn();
    const handlers = createHandlers({
      closePalette,
      selectTagFromCurrentContext,
    });

    handlers.handleTagSelect("tag-1");
    handlers.handleTagSelect("tag-1");

    expect(addToHistoryMock).toHaveBeenCalledOnce();
    expect(addToHistoryMock).toHaveBeenCalledWith("tag:tag-1");
    expect(selectTagFromCurrentContext).toHaveBeenCalledOnce();
    expect(selectTagFromCurrentContext).toHaveBeenCalledWith("tag-1");
    expect(closePalette).toHaveBeenCalledOnce();
  });

  it("allows a new submit after the palette session changes", () => {
    const closePalette = vi.fn();
    const { result, rerender } = renderHandlers({
      closePalette,
      paletteSessionId: 1,
    });

    result.current.handleActionSelect("open-settings");
    rerender({ overrides: { closePalette, paletteSessionId: 2 } });
    result.current.handleActionSelect("open-settings");

    expect(addToHistoryMock).toHaveBeenCalledTimes(2);
    expect(executeActionMock).toHaveBeenCalledTimes(2);
    expect(closePalette).toHaveBeenCalledTimes(2);
  });

  it("does not dispatch modal-blocked actions while another modal is already open", () => {
    useUiStore.setState({ settingsOpen: true });
    const handlers = createHandlers();

    handlers.handleActionSelect("open-add-feed");

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

  it("suppresses stale dev scenario failures after a newer scenario starts", async () => {
    const showToast = vi.fn();
    const staleScenario = createDeferred<void>();
    runRuntimeDevScenarioMock
      .mockReturnValueOnce(staleScenario.promise)
      .mockRejectedValueOnce(new Error("latest boom"));
    const handlers = createHandlers({ showToast });

    handlers.handleDevScenarioSelect("open-add-feed-dialog");
    handlers.handleDevScenarioSelect("open-command-palette");
    staleScenario.reject(new Error("stale boom"));

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith('Failed to run dev scenario "open-command-palette": latest boom');
    });
    expect(showToast).not.toHaveBeenCalledWith(expect.stringContaining("stale boom"));
  });

  it("suppresses dev scenario failures after the palette session changes", async () => {
    const showToast = vi.fn();
    const staleScenario = createDeferred<void>();
    runRuntimeDevScenarioMock.mockReturnValueOnce(staleScenario.promise);
    const { result, rerender } = renderHandlers({
      showToast,
      paletteSessionId: 1,
    });

    result.current.handleDevScenarioSelect("open-add-feed-dialog");
    rerender({ overrides: { showToast, paletteSessionId: 2 } });
    staleScenario.reject(new Error("stale boom"));

    await waitFor(() => {
      expect(runRuntimeDevScenarioMock).toHaveBeenCalledOnce();
    });
    expect(showToast).not.toHaveBeenCalled();
  });

  it("writes feed history and closes the palette without a success toast for feed landing", async () => {
    const closePalette = vi.fn();
    const showToast = vi.fn();
    const openFeedLanding = vi.fn().mockResolvedValue(
      Result.succeed({
        type: "feed_selected",
        feedId: "feed-1",
        articleId: "art-1",
      }),
    );
    const handlers = createHandlers({
      closePalette,
      showToast,
      openFeedLanding,
    });

    handlers.handleFeedSelect("feed-1");

    expect(addToHistoryMock).toHaveBeenCalledWith("feed:feed-1");
    expect(openFeedLanding).toHaveBeenCalledWith("feed-1");
    expect(closePalette).toHaveBeenCalledOnce();
    await waitFor(() => {
      expect(showToast).not.toHaveBeenCalled();
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
