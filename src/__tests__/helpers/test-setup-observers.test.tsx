import { render } from "@testing-library/react";
import { StrictMode, useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  flushTestMutationObservers,
  flushTestResizeObservers,
  getTestMutationObservers,
  getTestResizeObservers,
  installTestObserverMocks,
  resetTestObserverMocks,
} from "../../../tests/setup";

describe("test setup observer mocks", () => {
  afterEach(() => {
    resetTestObserverMocks();
    vi.useRealTimers();
  });

  it("flushes observer callbacks in creation order without depending on fake timers", () => {
    vi.useFakeTimers();
    installTestObserverMocks();
    const calls: string[] = [];

    new ResizeObserver(() => calls.push("resize:first"));
    new MutationObserver(() => calls.push("mutation:first"));
    new ResizeObserver(() => calls.push("resize:second"));

    flushTestResizeObservers();
    flushTestMutationObservers();
    vi.runAllTimers();

    expect(calls).toEqual(["resize:first", "resize:second", "mutation:first"]);
  });

  it("disconnects active observers during shared cleanup after StrictMode double invoke", () => {
    installTestObserverMocks();

    function ObserverProbe() {
      useEffect(() => {
        const resizeObserver = new ResizeObserver(() => {});
        const mutationObserver = new MutationObserver(() => {});

        resizeObserver.observe(document.body);
        mutationObserver.observe(document.body, { childList: true });

        return () => {
          resizeObserver.disconnect();
          mutationObserver.disconnect();
        };
      }, []);

      return null;
    }

    render(
      <StrictMode>
        <ObserverProbe />
      </StrictMode>,
    );

    const resizeObservers = getTestResizeObservers();
    const mutationObservers = getTestMutationObservers();

    expect(resizeObservers).toHaveLength(2);
    expect(mutationObservers).toHaveLength(2);
    expect(resizeObservers[0]?.disconnect).toHaveBeenCalledOnce();
    expect(mutationObservers[0]?.disconnect).toHaveBeenCalledOnce();
    expect(resizeObservers[1]?.disconnect).not.toHaveBeenCalled();
    expect(mutationObservers[1]?.disconnect).not.toHaveBeenCalled();

    const activeResizeObserver = resizeObservers[1];
    const activeMutationObserver = mutationObservers[1];

    resetTestObserverMocks();

    expect(activeResizeObserver?.disconnect).toHaveBeenCalledOnce();
    expect(activeMutationObserver?.disconnect).toHaveBeenCalledOnce();
    expect(getTestResizeObservers()).toHaveLength(0);
    expect(getTestMutationObservers()).toHaveLength(0);
  });
});
