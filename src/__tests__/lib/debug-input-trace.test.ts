import { describe, expect, it, vi } from "vitest";
import { APP_EVENTS } from "@/constants/events";
import {
  buildDebugHudClipboardText,
  emitDebugInputTrace,
  formatRawClickTrace,
  formatRawKeyboardTrace,
  formatRawPointerTrace,
  resolveDebugTraceSource,
} from "@/lib/debug/debug-input-trace";

function expectCustomEvent(value: unknown): asserts value is CustomEvent<string> {
  expect(value).toBeInstanceOf(CustomEvent);
}

describe("debug-input-trace", () => {
  it("formats raw keyboard, pointer, and click traces", () => {
    expect(formatRawKeyboardTrace("Enter", "button | label=Open")).toMatch(
      /^\d{2}:\d{2}:\d{2}\.\d{3} raw-key Enter target=button \| label=Open$/,
    );
    expect(
      formatRawPointerTrace({
        type: "pointerdown",
        clientX: 12.4,
        clientY: 98.6,
        targetDescription: "div",
      }),
    ).toMatch(/ raw-pointer pointerdown x=12 y=99 target=div$/);
    expect(formatRawClickTrace(12.5, 98.4, "a")).toMatch(/ raw-click x=13 y=98 target=a$/);
  });

  it("redacts typed key values and target descriptions for sensitive editable targets", () => {
    const passwordInput = document.createElement("input");
    passwordInput.type = "password";
    passwordInput.setAttribute("aria-label", "Account password");

    expect(formatRawKeyboardTrace("s", "input | label=Account password", passwordInput)).toMatch(
      / raw-key \[redacted\] target=input \| sensitive=\[redacted\]$/,
    );
    expect(formatRawKeyboardTrace("Tab", "input | label=Account password", passwordInput)).toMatch(
      / raw-key Tab target=input \| sensitive=\[redacted\]$/,
    );

    const serverUrlInput = document.createElement("input");
    serverUrlInput.name = "server_url";
    expect(formatRawClickTrace(1, 2, "input | label=Server URL", serverUrlInput)).toMatch(
      / raw-click x=1 y=2 target=input \| sensitive=\[redacted\]$/,
    );
  });

  it("limits debug HUD clipboard text to recent redacted traces", () => {
    const text = buildDebugHudClipboardText({
      focusedPane: "list",
      contentMode: "reader",
      selectedArticleId: "article-1",
      browserCloseInFlight: false,
      pendingBrowserCloseAction: null,
      activeElementDescription: "input | label=Server URL",
      traces: Array.from({ length: 12 }, (_, index) => `12:00:00.${String(index).padStart(3, "0")} trace-${index}`),
    });

    expect(text).toContain("trace_omitted=4");
    expect(text).not.toContain("trace-3");
    expect(text).toContain("trace-11");
    expect(text).toContain("input | sensitive=[redacted]");

    const redactedTraceText = buildDebugHudClipboardText({
      focusedPane: "list",
      contentMode: "reader",
      selectedArticleId: null,
      browserCloseInFlight: false,
      pendingBrowserCloseAction: null,
      activeElementDescription: "button",
      traces: ["12:00:00.000 raw-key a target=input | label=Server URL"],
    });
    expect(redactedTraceText).toContain("target=input | sensitive=[redacted]");
    expect(redactedTraceText).not.toContain("Server URL");
  });

  it("emits debug input trace events with timestamped details", () => {
    const listener = vi.fn();
    window.addEventListener(APP_EVENTS.debugInputTrace, listener);

    emitDebugInputTrace("queue next-article");

    window.removeEventListener(APP_EVENTS.debugInputTrace, listener);
    expect(listener).toHaveBeenCalledOnce();
    const event = listener.mock.calls[0]?.[0];
    expectCustomEvent(event);
    expect(event.detail).toMatch(/^\d{2}:\d{2}:\d{2}\.\d{3} queue next-article$/);
  });

  it("keeps debug trace sources separated from production log commands", () => {
    expect(resolveDebugTraceSource("raw-key Enter target=button")).toBe("input");
    expect(resolveDebugTraceSource("12:00:00.000 raw-pointer pointerdown x=12 y=99 target=main")).toBe("input");
    expect(resolveDebugTraceSource("window-mouse 3 -> mouse-back")).toBe("input");
    expect(resolveDebugTraceSource("12:00:00.000 menu-action next-article")).toBe("input");
    expect(resolveDebugTraceSource("browser-geometry resize width=1200 height=800")).toBe("browser_geometry");
    expect(resolveDebugTraceSource("12:00:00.000 browser-geometry resize width=1200 height=800")).toBe(
      "browser_geometry",
    );
    expect(resolveDebugTraceSource("sync-error account=acc-1 kind=network")).toBe("sync_error");
    expect(resolveDebugTraceSource("12:00:00.000 sync-error account=acc-1 kind=network")).toBe("sync_error");
    expect(resolveDebugTraceSource("hud-copy success")).toBe("app");
    expect(resolveDebugTraceSource("open_log_dir")).toBe("app");
    expect(resolveDebugTraceSource("rotate_file_log")).toBe("app");
  });
});
