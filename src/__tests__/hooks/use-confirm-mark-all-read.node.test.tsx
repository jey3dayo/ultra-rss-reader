import "@testing-library/react/dont-cleanup-after-each";
import { Result } from "@praha/byethrow";
import { act, cleanup, renderHook } from "@testing-library/react";
import { setupBrowserTestDom } from "@tests/helpers/browser-test-globals";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { closeBrowserWebview } from "@/api/tauri-commands";
import { useConfirmMarkAllRead } from "@/hooks/use-confirm-mark-all-read";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";

vi.mock("@/api/tauri-commands", () => ({
  closeBrowserWebview: vi.fn(),
}));

const closeBrowserWebviewMock = vi.mocked(closeBrowserWebview);

setupBrowserTestDom();

afterEach(async () => {
  cleanup();
  await new Promise<void>((resolve) => setImmediate(resolve));
});

vi.mock("react-i18next", () => {
  return {
    useTranslation: (namespace: string) => ({
      t: (key: string, options?: { count?: number }) =>
        namespace === "reader" ? `${key}:${options?.count ?? ""}` : key,
    }),
  };
});

describe("useConfirmMarkAllRead", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    closeBrowserWebviewMock.mockResolvedValue(Result.succeed(null));
    useUiStore.setState(useUiStore.getInitialState());
    usePreferencesStore.setState({ prefs: {}, loaded: true });
  });

  it.each([
    0,
    -1,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
  ])("does not confirm or run the action for invalid count %s", (count) => {
    const onConfirm = vi.fn();
    const showConfirm = vi.fn();
    useUiStore.setState({ showConfirm });
    const { result } = renderHook(() => useConfirmMarkAllRead());

    act(() => {
      result.current({ count, scope: "visible", onConfirm });
    });

    expect(showConfirm).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("opens a warning confirmation for a positive count when confirmation is enabled", () => {
    const onConfirm = vi.fn();
    const showConfirm = vi.fn();
    useUiStore.setState({ showConfirm });
    usePreferencesStore.setState({
      prefs: { ask_before_mark_all: "true" },
      loaded: true,
    });
    const { result } = renderHook(() => useConfirmMarkAllRead());

    act(() => {
      result.current({ count: 3, scope: "feed", onConfirm });
    });

    expect(showConfirm).toHaveBeenCalledWith("confirm_mark_feed_read:3", onConfirm, {
      actionLabel: "mark_as_read_count_action",
      actionAccessibleLabel: "mark_read_count_accessible_label:3",
      variant: "warning",
    });
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("closes the native browser preview before opening the confirmation dialog", async () => {
    const onConfirm = vi.fn();
    const showConfirm = vi.fn();
    const closeBrowser = vi.fn();
    const setBrowserCloseInFlight = vi.fn();
    useUiStore.setState({
      selectedArticleId: "article-1",
      contentMode: "browser",
      browserUrl: "https://example.com/article",
      closeBrowser,
      setBrowserCloseInFlight,
      showConfirm,
    });
    usePreferencesStore.setState({
      prefs: { ask_before_mark_all: "true" },
      loaded: true,
    });
    const { result } = renderHook(() => useConfirmMarkAllRead());

    act(() => {
      result.current({ count: 3, scope: "folder", onConfirm });
    });

    expect(setBrowserCloseInFlight).toHaveBeenCalledWith(true);
    expect(closeBrowserWebviewMock).toHaveBeenCalledTimes(1);
    expect(closeBrowser).not.toHaveBeenCalled();
    expect(showConfirm).not.toHaveBeenCalled();

    await act(async () => {
      await Promise.resolve();
    });

    expect(closeBrowser).toHaveBeenCalledTimes(1);
    expect(showConfirm).toHaveBeenCalledTimes(1);
    expect(closeBrowser.mock.invocationCallOrder[0]).toBeLessThan(showConfirm.mock.invocationCallOrder[0]);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("runs the action directly for a positive count when confirmation is disabled", () => {
    const onConfirm = vi.fn();
    const showConfirm = vi.fn();
    useUiStore.setState({ showConfirm });
    usePreferencesStore.setState({
      prefs: { ask_before_mark_all: "false" },
      loaded: true,
    });
    const { result } = renderHook(() => useConfirmMarkAllRead());

    act(() => {
      result.current({ count: 3, scope: "visible", onConfirm });
    });

    expect(showConfirm).not.toHaveBeenCalled();
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
