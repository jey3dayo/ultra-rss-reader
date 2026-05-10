import { afterEach, describe, expect, it, vi } from "vitest";
import { mockObserverConstructors } from "./typed-test-factories";

describe("mockObserverConstructors", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("cleans up shared observer mocks between tests", () => {
    const { resizeObservers, mutationObservers, cleanupObservers } = mockObserverConstructors();
    new ResizeObserver(() => {});
    new MutationObserver(() => {});

    expect(resizeObservers).toHaveLength(1);
    expect(mutationObservers).toHaveLength(1);
    const resizeObserver = resizeObservers[0];
    const mutationObserver = mutationObservers[0];

    cleanupObservers();

    expect(resizeObserver?.disconnect).toHaveBeenCalledTimes(1);
    expect(mutationObserver?.disconnect).toHaveBeenCalledTimes(1);
    expect(resizeObservers).toHaveLength(0);
    expect(mutationObservers).toHaveLength(0);
  });
});
