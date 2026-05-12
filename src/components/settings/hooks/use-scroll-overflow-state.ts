import { useCallback, useLayoutEffect, useReducer, useRef } from "react";
import { scheduleAnimationFrameWithTimeoutFallback } from "@/lib/dom/animation-frame";
import { bindWindowEvents } from "@/lib/window/window-events";

type ScrollOverflowState = {
  viewportElement: HTMLDivElement | null;
  hasOverflow: boolean;
};

type ScrollOverflowAction =
  | { type: "set-viewport-element"; value: HTMLDivElement | null }
  | { type: "set-has-overflow"; value: boolean };

const initialScrollOverflowState: ScrollOverflowState = {
  viewportElement: null,
  hasOverflow: false,
};

type ScrollOverflowObserverLifecycle = {
  connect: () => void;
  disconnect: () => void;
};

function createScrollOverflowObserverLifecycle(
  viewport: HTMLDivElement,
  onContentChange: () => void,
): ScrollOverflowObserverLifecycle | null {
  if (typeof ResizeObserver === "undefined") {
    return null;
  }

  const resizeObserver = new ResizeObserver(() => {
    observeContentElement();
    onContentChange();
  });
  let observedContentElement: HTMLElement | null = null;
  const observeContentElement = () => {
    const content = viewport.firstElementChild;
    if (!(content instanceof HTMLElement) || content === observedContentElement) {
      return;
    }
    if (observedContentElement) {
      resizeObserver.unobserve(observedContentElement);
    }
    observedContentElement = content;
    resizeObserver.observe(content);
  };
  const mutationObserver =
    typeof MutationObserver === "undefined"
      ? null
      : new MutationObserver(() => {
          observeContentElement();
          onContentChange();
        });

  return {
    connect: () => {
      resizeObserver.observe(viewport);
      observeContentElement();
      mutationObserver?.observe(viewport, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
      });
    },
    disconnect: () => {
      mutationObserver?.disconnect();
      resizeObserver.disconnect();
    },
  };
}

function scrollOverflowReducer(state: ScrollOverflowState, action: ScrollOverflowAction): ScrollOverflowState {
  switch (action.type) {
    case "set-viewport-element":
      return { ...state, viewportElement: action.value };
    case "set-has-overflow":
      return { ...state, hasOverflow: action.value };
    default:
      return state;
  }
}

export function useScrollOverflowState(dependency: unknown) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [state, dispatch] = useReducer(scrollOverflowReducer, initialScrollOverflowState);
  const { viewportElement, hasOverflow } = state;

  const setViewportNode = useCallback((node: HTMLDivElement | null) => {
    viewportRef.current = node;
    dispatch({ type: "set-viewport-element", value: node });
  }, []);

  useLayoutEffect(() => {
    void dependency;

    const viewport = viewportElement;

    if (!viewport) {
      return;
    }

    let isActive = true;
    const updateOverflow = () => {
      if (!isActive) {
        return;
      }

      dispatch({
        type: "set-has-overflow",
        value: viewport.scrollHeight > viewport.clientHeight + 1,
      });
    };
    let cancelPendingMeasurement: (() => void) | null = null;
    const scheduleUpdateOverflow = () => {
      if (cancelPendingMeasurement) {
        return;
      }
      cancelPendingMeasurement = scheduleAnimationFrameWithTimeoutFallback(() => {
        cancelPendingMeasurement = null;
        updateOverflow();
      });
    };

    updateOverflow();
    const cancelMeasurement = scheduleAnimationFrameWithTimeoutFallback(() => {
      updateOverflow();
    });
    const removeWindowEvents = bindWindowEvents([{ type: "resize", listener: updateOverflow }]);
    const observerLifecycle = createScrollOverflowObserverLifecycle(viewport, scheduleUpdateOverflow);
    observerLifecycle?.connect();

    return () => {
      isActive = false;
      cancelMeasurement();
      cancelPendingMeasurement?.();
      removeWindowEvents();
      observerLifecycle?.disconnect();
    };
  }, [dependency, viewportElement]);

  return {
    hasOverflow,
    viewportElement,
    viewportRef: setViewportNode,
  };
}
