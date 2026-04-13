import { act, renderHook } from "@testing-library/react";
import { useRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import type { BrowserWebviewState } from "@/api/tauri-commands";
import { useBrowserWebviewStateChanged } from "@/components/reader/use-browser-webview-state-changed";

function createState(url: string, isLoading: boolean): BrowserWebviewState {
  return {
    url,
    can_go_back: false,
    can_go_forward: false,
    is_loading: isLoading,
  };
}

describe("useBrowserWebviewStateChanged", () => {
  it("merges the incoming state with the current browser state and clears fallback mode", () => {
    const setSurfaceIssue = vi.fn();
    const { result } = renderHook(() => {
      const [browserState, setBrowserState] = useState<BrowserWebviewState | null>(
        createState("https://example.com/old", false),
      );
      const browserStateRef = useRef<BrowserWebviewState | null>(browserState);
      browserStateRef.current = browserState;
      const fallbackInFlightRef = useRef(true);

      const handleStateChanged = useBrowserWebviewStateChanged({
        browserStateRef,
        fallbackInFlightRef,
        setBrowserState,
        setSurfaceIssue,
        getRequestedUrl: () => "https://example.com/new",
      });

      return { browserState, browserStateRef, fallbackInFlightRef, handleStateChanged };
    });

    act(() => {
      result.current.handleStateChanged({
        url: "https://example.com/new",
        can_go_back: true,
        can_go_forward: false,
        is_loading: true,
      });
    });

    expect(result.current.browserState).toEqual({
      url: "https://example.com/old",
      can_go_back: true,
      can_go_forward: false,
      is_loading: false,
    });
    expect(result.current.browserStateRef.current).toEqual(result.current.browserState);
    expect(result.current.fallbackInFlightRef.current).toBe(false);
    expect(setSurfaceIssue).toHaveBeenCalledWith(null);
  });
});
