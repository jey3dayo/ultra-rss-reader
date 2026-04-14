import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useScreenSnapshot } from "@/hooks/use-screen-snapshot";

describe("useScreenSnapshot", () => {
  it("adopts immediately on the initial render when canAdopt is true", () => {
    const { result } = renderHook(() => useScreenSnapshot({ value: "sqlite" }, true));

    expect(result.current.snapshot).toEqual({ value: "sqlite" });
    expect(result.current.hasResolvedSnapshot).toBe(true);
    expect(result.current.hasAdoptedSnapshot).toBe(true);
  });

  it("keeps the previous snapshot while the next fetch is pending", () => {
    const { result, rerender } = renderHook(({ candidate, canAdopt }) => useScreenSnapshot(candidate, canAdopt), {
      initialProps: {
        candidate: null as { value: string } | null,
        canAdopt: false,
      },
    });

    expect(result.current.snapshot).toBeNull();
    expect(result.current.hasResolvedSnapshot).toBe(false);
    expect(result.current.hasAdoptedSnapshot).toBe(false);

    rerender({
      candidate: { value: "sqlite" },
      canAdopt: true,
    });

    expect(result.current.snapshot).toEqual({ value: "sqlite" });
    expect(result.current.hasResolvedSnapshot).toBe(true);
    expect(result.current.hasAdoptedSnapshot).toBe(true);

    rerender({
      candidate: null,
      canAdopt: false,
    });

    expect(result.current.snapshot).toEqual({ value: "sqlite" });
    expect(result.current.hasResolvedSnapshot).toBe(true);
    expect(result.current.hasAdoptedSnapshot).toBe(true);
  });

  it("keeps the previous snapshot when the candidate changes while canAdopt is false", () => {
    const { result, rerender } = renderHook(({ candidate, canAdopt }) => useScreenSnapshot(candidate, canAdopt), {
      initialProps: {
        candidate: { value: "first" } as { value: string } | null,
        canAdopt: true,
      },
    });

    expect(result.current.snapshot).toEqual({ value: "first" });
    expect(result.current.hasResolvedSnapshot).toBe(true);
    expect(result.current.hasAdoptedSnapshot).toBe(true);

    rerender({
      candidate: { value: "second" },
      canAdopt: false,
    });

    expect(result.current.snapshot).toEqual({ value: "first" });
    expect(result.current.hasResolvedSnapshot).toBe(true);
    expect(result.current.hasAdoptedSnapshot).toBe(true);
  });

  it("adopts the latest candidate when canAdopt toggles from false to true", () => {
    const { result, rerender } = renderHook(({ candidate, canAdopt }) => useScreenSnapshot(candidate, canAdopt), {
      initialProps: {
        candidate: null as { value: string } | null,
        canAdopt: false,
      },
    });

    expect(result.current.snapshot).toBeNull();
    expect(result.current.hasResolvedSnapshot).toBe(false);
    expect(result.current.hasAdoptedSnapshot).toBe(false);

    rerender({
      candidate: { value: "queued" },
      canAdopt: false,
    });

    expect(result.current.snapshot).toBeNull();
    expect(result.current.hasResolvedSnapshot).toBe(false);
    expect(result.current.hasAdoptedSnapshot).toBe(false);

    rerender({
      candidate: { value: "queued" },
      canAdopt: true,
    });

    expect(result.current.snapshot).toEqual({ value: "queued" });
    expect(result.current.hasResolvedSnapshot).toBe(true);
    expect(result.current.hasAdoptedSnapshot).toBe(true);
  });

  it("treats a null candidate as unresolved while canAdopt is true", () => {
    const { result, rerender } = renderHook(({ candidate, canAdopt }) => useScreenSnapshot(candidate, canAdopt), {
      initialProps: {
        candidate: { value: "adopted" } as { value: string } | null,
        canAdopt: true,
      },
    });

    expect(result.current.snapshot).toEqual({ value: "adopted" });
    expect(result.current.hasResolvedSnapshot).toBe(true);
    expect(result.current.hasAdoptedSnapshot).toBe(true);

    rerender({
      candidate: null,
      canAdopt: true,
    });

    expect(result.current.snapshot).toEqual({ value: "adopted" });
    expect(result.current.hasResolvedSnapshot).toBe(true);
    expect(result.current.hasAdoptedSnapshot).toBe(true);
  });

  it("stays unresolved when canAdopt is true but no snapshot has been adopted yet", () => {
    const { result } = renderHook(() => useScreenSnapshot(null, true));

    expect(result.current.snapshot).toBeNull();
    expect(result.current.hasResolvedSnapshot).toBe(false);
    expect(result.current.hasAdoptedSnapshot).toBe(false);
  });
});
