import { Result } from "@praha/byethrow";
import { renderHook, waitFor } from "@testing-library/react";
import { createQueryWrapper } from "@tests/helpers/create-wrapper";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createQuery, setCreateQueryDiagnosticsReporterForDiagnostics } from "@/hooks/create-query";

describe("createQuery", () => {
  let wrapper: ReturnType<typeof createQueryWrapper>["wrapper"];
  let restoreDiagnosticsReporter: (() => void) | null = null;
  type GeneratedQueryProps = { id: string | null };

  beforeEach(() => {
    const queryWrapper = createQueryWrapper();
    wrapper = queryWrapper.wrapper;
  });

  afterEach(() => {
    restoreDiagnosticsReporter?.();
    restoreDiagnosticsReporter = null;
  });

  it("keeps nullable id queries disabled and calls the fetcher for string ids", async () => {
    const fetcher = vi.fn((id: string) => Promise.resolve(Result.succeed({ id })));
    const useGeneratedQuery = createQuery("items", fetcher);
    const initialProps: GeneratedQueryProps = { id: null };

    const { rerender, result } = renderHook(({ id }: GeneratedQueryProps) => useGeneratedQuery(id), {
      initialProps,
      wrapper,
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(result.current.failureCount).toBe(0);
    expect(fetcher).not.toHaveBeenCalled();

    rerender({ id: "item-1" });

    await waitFor(() => {
      expect(result.current.data).toEqual({ id: "item-1" });
    });
    expect(fetcher).toHaveBeenCalledWith("item-1");
  });

  it("disables the generated query again when the account id disappears", async () => {
    const fetcher = vi.fn((id: string) => Promise.resolve(Result.succeed({ id })));
    const useGeneratedQuery = createQuery("items", fetcher);
    const initialProps: GeneratedQueryProps = { id: "acc-1" };

    const { rerender, result } = renderHook(({ id }: GeneratedQueryProps) => useGeneratedQuery(id), {
      initialProps,
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.data).toEqual({ id: "acc-1" });
    });

    rerender({ id: null });

    expect(result.current.fetchStatus).toBe("idle");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("keeps generated query retry disabled at the hook boundary", async () => {
    const fetcher = vi.fn(async () => Result.fail({ message: "temporary load failure" }));
    const useGeneratedQuery = createQuery("items", fetcher);

    const { result } = renderHook(() => useGeneratedQuery("item-1"), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result.current.failureCount).toBe(1);
  });

  it("unwraps Result.fail into a query error", async () => {
    const fetcher = vi.fn(async () => Result.fail({ message: "load failed" }));
    const useGeneratedQuery = createQuery("items", fetcher);
    const diagnosticsReporter = vi.fn();
    restoreDiagnosticsReporter = setCreateQueryDiagnosticsReporterForDiagnostics(diagnosticsReporter);

    const { result } = renderHook(({ id }: GeneratedQueryProps) => useGeneratedQuery(id), {
      initialProps: { id: "item-1" },
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(fetcher).toHaveBeenCalledWith("item-1");
    expect(result.current.error).toMatchObject({ message: "[items:item-1] load failed" });
    expect(diagnosticsReporter).toHaveBeenCalledWith({
      type: "query-function-rejected",
      queryKey: "items",
      queryId: "item-1",
      error: expect.objectContaining({ message: "[items:item-1] load failed" }),
    });
  });

  it("redacts the query id from default query rejection diagnostics", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetcher = vi.fn(async () => Result.fail({ message: "load failed" }));
    const useGeneratedQuery = createQuery("items", fetcher);

    const { result } = renderHook(() => useGeneratedQuery("account-secret-1"), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toMatchObject({ message: "[items:account-secret-1] load failed" });
    expect(warnSpy).toHaveBeenCalledWith("[createQuery] generated queryFn rejected:", {
      queryKey: "items",
      queryId: "<redacted>",
      error: expect.objectContaining({ message: "[items:<redacted>] load failed" }),
    });
    expect(JSON.stringify(warnSpy.mock.calls)).not.toContain("account-secret-1");

    warnSpy.mockRestore();
  });

  it("does not pass missing or invalid disabled ids to the fetcher", () => {
    const fetcher = vi.fn((id: string) => Promise.resolve(Result.succeed({ id })));
    const useGeneratedQuery = createQuery("items", fetcher);
    const initialProps: { id: string | null | undefined } = {
      id: undefined,
    };

    const { rerender, result } = renderHook(
      ({ id }: { id: string | null | undefined }) => useGeneratedQuery(id ?? null),
      {
        initialProps,
        wrapper,
      },
    );

    expect(result.current.fetchStatus).toBe("idle");
    expect(fetcher).not.toHaveBeenCalled();

    rerender({ id: null });

    expect(result.current.fetchStatus).toBe("idle");
    expect(fetcher).not.toHaveBeenCalled();

    rerender({ id: "" });

    expect(result.current.fetchStatus).toBe("idle");
    expect(fetcher).not.toHaveBeenCalled();

    expect(() => rerender({ id: "   " })).not.toThrow();

    expect(result.current.fetchStatus).toBe("idle");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("emits diagnostics if a disabled generated query is forced to refetch", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetcher = vi.fn((id: string) => Promise.resolve(Result.succeed({ id })));
    const useGeneratedQuery = createQuery("items", fetcher);

    const { result } = renderHook(() => useGeneratedQuery(null), {
      wrapper,
    });

    const refetchResult = await result.current.refetch();

    expect(refetchResult.error).toMatchObject({ message: "Query id is required when the query is enabled." });
    expect(fetcher).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith("[createQuery] queryFn called while generated query is disabled:", {
      queryKey: "items",
    });

    warnSpy.mockRestore();
  });

  it("trims query ids before building the cache key and calling the fetcher", async () => {
    const queryWrapper = createQueryWrapper();
    const fetcher = vi.fn((id: string) => Promise.resolve(Result.succeed({ id })));
    const useGeneratedQuery = createQuery("items", fetcher);

    const { result } = renderHook(() => useGeneratedQuery(" item-1\n"), {
      wrapper: queryWrapper.wrapper,
    });

    await waitFor(() => {
      expect(result.current.data).toEqual({ id: "item-1" });
    });
    expect(fetcher).toHaveBeenCalledWith("item-1");
    expect(queryWrapper.queryClient.getQueryState(["items", "item-1"])).toBeDefined();
    expect(queryWrapper.queryClient.getQueryState(["items", " item-1\n"])).toBeUndefined();
  });
});
