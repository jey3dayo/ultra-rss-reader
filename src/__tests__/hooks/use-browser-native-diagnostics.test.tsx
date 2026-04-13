import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useBrowserNativeDiagnostics } from "@/components/reader/use-browser-native-diagnostics";

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
