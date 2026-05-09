import { useCallback, useLayoutEffect, useReducer, useRef } from "react";
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

    const updateOverflow = () => {
      dispatch({
        type: "set-has-overflow",
        value: viewport.scrollHeight > viewport.clientHeight + 1,
      });
    };

    updateOverflow();
    const animationFrame = window.requestAnimationFrame(() => {
      updateOverflow();
    });
    const removeWindowEvents = bindWindowEvents([{ type: "resize", listener: updateOverflow }]);

    if (typeof ResizeObserver === "undefined") {
      return () => {
        window.cancelAnimationFrame(animationFrame);
        removeWindowEvents();
      };
    }

    let resizeObserver: ResizeObserver;
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
    resizeObserver = new ResizeObserver(() => {
      observeContentElement();
      updateOverflow();
    });
    const mutationObserver =
      typeof MutationObserver === "undefined"
        ? null
        : new MutationObserver(() => {
            observeContentElement();
            updateOverflow();
          });

    resizeObserver.observe(viewport);
    observeContentElement();
    mutationObserver?.observe(viewport, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
    });

    return () => {
      window.cancelAnimationFrame(animationFrame);
      removeWindowEvents();
      mutationObserver?.disconnect();
      resizeObserver.disconnect();
    };
  }, [dependency, viewportElement]);

  return {
    hasOverflow,
    viewportElement,
    viewportRef: setViewportNode,
  };
}
