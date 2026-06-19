import { type PointerEvent, useEffect, useReducer } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { FocusDebugHudView } from "@/components/debug/focus-debug-hud-view";
import { APP_EVENTS } from "@/constants/events";
import { type BrowserDebugGeometrySnapshot, getBrowserGeometryRows } from "@/lib/browser/browser-debug-geometry";
import { isBrowserDebugGeometryDetail } from "@/lib/browser/browser-debug-geometry-guards";
import { describeDebugHudEventTarget } from "@/lib/debug/debug-hud-active-element";
import {
  buildDebugHudClipboardText,
  emitDebugInputTrace,
  formatRawClickTrace,
  formatRawKeyboardTrace,
  formatRawPointerTrace,
} from "@/lib/debug/debug-input-trace";
import { copyValueToClipboard } from "@/lib/runtime/clipboard";
import { attachTauriListeners, listenTauriEvent } from "@/lib/runtime/tauri-event-listeners";
import {
  bindWindowEvents,
  createCustomEventDetailListener,
  createKeyboardEventListener,
  createMouseEventListener,
  createPointerEventListener,
} from "@/lib/window/window-events";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";
import { getFocusDebugHudActiveElementDescription, resolveFocusDebugHudPortalTarget } from "./focus-debug-hud-dom";

type FocusDebugHudState = {
  activeElementDescription: string;
  traces: string[];
  browserGeometry: BrowserDebugGeometrySnapshot | null;
};

type FocusDebugHudAction =
  | { type: "set-active-element"; value: string }
  | { type: "append-trace"; value: string }
  | { type: "append-browser-trace"; value: string }
  | {
      type: "set-browser-geometry";
      value: BrowserDebugGeometrySnapshot | null;
    };

const initialFocusDebugHudState: FocusDebugHudState = {
  activeElementDescription: "none",
  traces: [],
  browserGeometry: null,
};

function pushTraceLine(traces: string[], value: string, maxLines: number): string[] {
  return [...traces.slice(-(maxLines - 1)), value];
}

function focusDebugHudReducer(state: FocusDebugHudState, action: FocusDebugHudAction): FocusDebugHudState {
  const MAX_TRACE_LINES = 20;

  switch (action.type) {
    case "set-active-element":
      return { ...state, activeElementDescription: action.value };
    case "append-trace":
      return {
        ...state,
        traces: pushTraceLine(state.traces, action.value, MAX_TRACE_LINES),
      };
    case "append-browser-trace":
      return {
        ...state,
        traces: pushTraceLine(state.traces, action.value, 6),
      };
    case "set-browser-geometry":
      return { ...state, browserGeometry: action.value };
    default:
      return state;
  }
}

export type FocusDebugHudProps = {
  temporarilyHidden?: boolean;
  avoidBottomRight?: boolean;
};

function normalizeDebugHudClipboardText(text: string): string {
  return Array.from(text, (char) => {
    const codePoint = char.codePointAt(0);
    return codePoint !== undefined && (codePoint < 32 || codePoint === 127) ? " | " : char;
  }).join("");
}

export function FocusDebugHud({ temporarilyHidden = false, avoidBottomRight = false }: FocusDebugHudProps) {
  const { t } = useTranslation("reader");
  const focusedPane = useUiStore((state) => state.focusedPane);
  const contentMode = useUiStore((state) => state.contentMode);
  const selectedArticleId = useUiStore((state) => state.selectedArticleId);
  const browserCloseInFlight = useUiStore((state) => state.browserCloseInFlight);
  const pendingBrowserCloseAction = useUiStore((state) => state.pendingBrowserCloseAction);
  const showToast = useUiStore((state) => state.showToast);
  const setPref = usePreferencesStore((state) => state.setPref);
  const [state, dispatch] = useReducer(focusDebugHudReducer, initialFocusDebugHudState);
  const { activeElementDescription, traces, browserGeometry } = state;

  useEffect(() => {
    const update = () => {
      dispatch({
        type: "set-active-element",
        value: getFocusDebugHudActiveElementDescription(),
      });
    };

    update();
    const keyTraceListener = createKeyboardEventListener((event) => {
      dispatch({
        type: "append-trace",
        value: formatRawKeyboardTrace(event.key, describeDebugHudEventTarget(event.target), event.target),
      });
    });
    const traceListener = createCustomEventDetailListener(
      (value): value is string => typeof value === "string",
      (detail) => {
        dispatch({ type: "append-trace", value: detail });
      },
    );
    const geometryListener = createCustomEventDetailListener(isBrowserDebugGeometryDetail, (detail) => {
      dispatch({
        type: "set-browser-geometry",
        value: detail,
      });
    });
    const pointerTraceListener = createPointerEventListener((event) => {
      dispatch({
        type: "append-trace",
        value: formatRawPointerTrace({
          type: event.type,
          clientX: event.clientX,
          clientY: event.clientY,
          targetDescription: describeDebugHudEventTarget(event.target),
          target: event.target,
        }),
      });
    });
    const clickTraceListener = createMouseEventListener((event) => {
      dispatch({
        type: "append-trace",
        value: formatRawClickTrace(
          event.clientX,
          event.clientY,
          describeDebugHudEventTarget(event.target),
          event.target,
        ),
      });
    });

    return bindWindowEvents([
      { type: "focusin", listener: update, options: true },
      { type: "focusout", listener: update, options: true },
      { type: "keydown", listener: update, options: true },
      { type: "keydown", listener: keyTraceListener, options: true },
      { type: APP_EVENTS.debugInputTrace, listener: traceListener },
      { type: APP_EVENTS.browserDebugGeometry, listener: geometryListener },
      { type: "pointerdown", listener: pointerTraceListener, options: true },
      { type: "click", listener: clickTraceListener, options: true },
    ]);
  }, []);

  useEffect(() => {
    return attachTauriListeners(
      [
        listenTauriEvent<string>("browser-webview-debug-input", (event) => {
          dispatch({ type: "append-browser-trace", value: event.payload });
        }),
      ],
      {
        onUnavailable: () => {
          // browser mode / non-tauri
        },
      },
    );
  }, []);

  const debugHudText = buildDebugHudClipboardText({
    focusedPane,
    contentMode,
    selectedArticleId,
    browserCloseInFlight,
    pendingBrowserCloseAction,
    activeElementDescription,
    traces,
  });

  const handleCopy = async () => {
    emitDebugInputTrace("hud-copy start");
    const clipboardText = normalizeDebugHudClipboardText(debugHudText);

    await copyValueToClipboard(clipboardText, {
      onSuccess: () => {
        emitDebugInputTrace("hud-copy success");
        showToast(t("copied_to_clipboard"));
      },
      onError: (message, error) => {
        emitDebugInputTrace(`hud-copy error category=${error.category} message=${message}`);
        console.error("Failed to copy focus debug HUD:", error);
        showToast(message);
      },
    });
  };

  const hud = (
    <FocusDebugHudView
      focusedPane={focusedPane}
      contentMode={contentMode}
      selectedArticleId={selectedArticleId}
      browserCloseInFlight={browserCloseInFlight}
      pendingBrowserCloseAction={pendingBrowserCloseAction}
      activeElementDescription={activeElementDescription}
      browserGeometryRows={browserGeometry ? getBrowserGeometryRows(browserGeometry) : []}
      traces={traces}
      onCopyClick={() => {
        emitDebugInputTrace("hud-click");
        void handleCopy();
      }}
      onCopyPointerDown={(event: PointerEvent<HTMLButtonElement>) => {
        event.preventDefault();
        emitDebugInputTrace("hud-pointer-down");
      }}
      onCloseClick={() => setPref("debug_browser_hud", "false")}
      temporarilyHidden={temporarilyHidden}
      avoidBottomRight={avoidBottomRight}
    />
  );

  const portalTarget = resolveFocusDebugHudPortalTarget();
  if (portalTarget !== null) {
    return createPortal(hud, portalTarget);
  }

  return null;
}
