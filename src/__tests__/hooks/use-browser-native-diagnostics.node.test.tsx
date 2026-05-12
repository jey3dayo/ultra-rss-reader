import { act, cleanup, renderHook } from "@testing-library/react";
import { setupBrowserTestDom } from "@tests/helpers/browser-test-globals";
import { afterEach, describe, expect, it } from "vitest";
import { useBrowserNativeDiagnostics } from "@/components/reader/hooks/browser/use-browser-native-diagnostics";

setupBrowserTestDom();

afterEach(async () => {
  cleanup();
  await new Promise((resolve) => setTimeout(resolve, 0));
});

function createDiagnostics() {
  return {
    action: "create",
    requestedLogical: {
      x: 0,
      y: 56,
      width: 1400,
      height: 844,
    },
    appliedLogical: {
      x: 0,
      y: 56,
      width: 1400,
      height: 844,
    },
    scaleFactor: 1,
    nativeWebviewBounds: {
      x: 0,
      y: 56,
      width: 1400,
      height: 844,
    },
  };
}

describe("useBrowserNativeDiagnostics", () => {
  it("stores the latest native diagnostics payload", () => {
    const { result } = renderHook(() => useBrowserNativeDiagnostics(true));

    act(() => {
      result.current.handleNativeDiagnostics(createDiagnostics());
    });

    expect(result.current.nativeDiagnostics).toEqual(createDiagnostics());
  });

  it("clears native diagnostics when the debug hud is hidden", () => {
    const { result, rerender } = renderHook(({ showDiagnostics }) => useBrowserNativeDiagnostics(showDiagnostics), {
      initialProps: { showDiagnostics: true },
    });

    act(() => {
      result.current.handleNativeDiagnostics(createDiagnostics());
    });

    rerender({ showDiagnostics: false });

    expect(result.current.nativeDiagnostics).toBeNull();
  });
});
