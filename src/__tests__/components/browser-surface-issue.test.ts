import { describe, expect, it } from "vitest";
import {
  createBrowserSurfaceFailure,
  createBrowserSurfaceFallback,
  resolveRuntimeUnavailableSurfaceIssue,
} from "@/components/reader/browser-surface-issue";

const labels = {
  failed: "Web Preview couldn't load.",
  failedHint: "Try again, or open this page in your external browser.",
  blocked: "This page can't be shown in the in-app browser.",
  blockedHint: "Open it in your external browser instead.",
  browserMode: "Embedded preview isn't available in browser mode.",
  browserModeHint: "Use the desktop app for the native preview, or open this page in your external browser.",
};

describe("browser-surface-issue", () => {
  it("builds a retryable failure issue", () => {
    expect(createBrowserSurfaceFailure("boom", labels)).toEqual({
      kind: "failed",
      title: labels.failed,
      description: labels.failedHint,
      detail: "boom",
      canRetry: true,
    });
  });

  it("builds a fallback issue for both failed and blocked payloads", () => {
    expect(createBrowserSurfaceFallback("timed out", labels)).toEqual({
      kind: "failed",
      title: labels.failed,
      description: labels.failedHint,
      detail: "timed out",
      canRetry: true,
    });

    expect(createBrowserSurfaceFallback(null, labels)).toEqual({
      kind: "unsupported",
      title: labels.blocked,
      description: labels.blockedHint,
      detail: null,
      canRetry: false,
    });
  });

  it("only shows the browser-mode issue when runtime is unavailable and loading is done", () => {
    expect(
      resolveRuntimeUnavailableSurfaceIssue({
        runtimeUnavailable: true,
        isLoading: false,
        labels,
      }),
    ).toEqual({
      kind: "unsupported",
      title: labels.browserMode,
      description: labels.browserModeHint,
      detail: null,
      canRetry: false,
    });

    expect(
      resolveRuntimeUnavailableSurfaceIssue({
        runtimeUnavailable: true,
        isLoading: true,
        labels,
      }),
    ).toBeNull();
  });
});
