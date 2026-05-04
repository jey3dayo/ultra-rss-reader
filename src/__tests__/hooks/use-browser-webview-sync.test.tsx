import { Result } from "@praha/byethrow";
import { act, renderHook } from "@testing-library/react";
import { useRef, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BrowserWebviewState } from "@/api/tauri-commands";
import { useBrowserWebviewSync } from "@/components/reader/use-browser-webview-sync";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";

const { createOrUpdateBrowserWebviewMock, focusBrowserWebviewMock, setBrowserWebviewBoundsMock } = vi.hoisted(() => ({
  createOrUpdateBrowserWebviewMock: vi.fn(),
  focusBrowserWebviewMock: vi.fn(),
  setBrowserWebviewBoundsMock: vi.fn(),
}));

vi.mock("@/api/tauri-commands", () => ({
  createOrUpdateBrowserWebview: createOrUpdateBrowserWebviewMock,
  focusBrowserWebview: focusBrowserWebviewMock,
  setBrowserWebviewBounds: setBrowserWebviewBoundsMock,
}));

const browserUrl = "https://example.com/article";

function createBrowserState(overrides?: Partial<BrowserWebviewState>): BrowserWebviewState {
  return {
    url: browserUrl,
    can_go_back: false,
    can_go_forward: false,
    is_loading: false,
    ...overrides,
  };
}

function createHostElement() {
  const element = document.createElement("div");
  vi.spyOn(element, "getBoundingClientRect").mockReturnValue({
    x: 12,
    y: 34,
    top: 34,
    left: 12,
    right: 612,
    bottom: 434,
    width: 600,
    height: 400,
    toJSON: () => ({}),
  });
  return element;
}

describe("useBrowserWebviewSync", () => {
  beforeEach(() => {
    createOrUpdateBrowserWebviewMock.mockReset();
    focusBrowserWebviewMock.mockReset();
    setBrowserWebviewBoundsMock.mockReset();
    createOrUpdateBrowserWebviewMock.mockResolvedValue(Result.succeed(createBrowserState({ is_loading: true })));
    focusBrowserWebviewMock.mockResolvedValue(Result.succeed(null));
    setBrowserWebviewBoundsMock.mockResolvedValue(Result.succeed(null));
    usePreferencesStore.setState({ prefs: {}, loaded: true });
    useUiStore.setState({ ...useUiStore.getInitialState(), browserUrl });
  });

  it("does not restore focus after creating the webview when focus retention is disabled", async () => {
    const hostElement = createHostElement();
    const { result } = renderHook(() => {
      const hostRef = useRef<HTMLDivElement | null>(hostElement);
      const [browserState, setBrowserState] = useState<BrowserWebviewState | null>(null);
      const browserStateRef = useRef(browserState);
      browserStateRef.current = browserState;

      return useBrowserWebviewSync({
        hostRef,
        platformKind: "windows",
        browserStateRef,
        captureLayoutDiagnostics: vi.fn(),
        setBrowserState,
        onMissingEmbeddedBrowserWebview: vi.fn(),
        showSurfaceFailure: vi.fn(),
      });
    });

    await act(async () => {
      await result.current.syncBrowserWebview(browserUrl, "create");
    });

    expect(createOrUpdateBrowserWebviewMock).toHaveBeenCalledTimes(1);
    expect(focusBrowserWebviewMock).not.toHaveBeenCalled();
  });

  it("restores focus after creating the webview when focus retention is enabled", async () => {
    usePreferencesStore.setState({ prefs: { web_preview_keep_focus: "true" }, loaded: true });
    const hostElement = createHostElement();
    const { result } = renderHook(() => {
      const hostRef = useRef<HTMLDivElement | null>(hostElement);
      const [browserState, setBrowserState] = useState<BrowserWebviewState | null>(null);
      const browserStateRef = useRef(browserState);
      browserStateRef.current = browserState;

      return useBrowserWebviewSync({
        hostRef,
        platformKind: "windows",
        browserStateRef,
        captureLayoutDiagnostics: vi.fn(),
        setBrowserState,
        onMissingEmbeddedBrowserWebview: vi.fn(),
        showSurfaceFailure: vi.fn(),
      });
    });

    await act(async () => {
      await result.current.syncBrowserWebview(browserUrl, "create");
    });

    expect(createOrUpdateBrowserWebviewMock).toHaveBeenCalledTimes(1);
    expect(focusBrowserWebviewMock).toHaveBeenCalledTimes(1);
  });
});
