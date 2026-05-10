import { Result } from "@praha/byethrow";
import type { QueryClient } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { createQueryWrapper } from "@tests/helpers/create-wrapper";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppError } from "@/api/schemas/error";
import { createMutation } from "@/hooks/create-mutation";
import { useUiStore } from "@/stores/ui-store";

type TestArgs = {
  id: string;
};

type TestData = {
  savedId: string;
};

describe("createMutation", () => {
  beforeEach(() => {
    useUiStore.setState(useUiStore.getInitialState());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function renderGeneratedMutation({
    mutationFn,
    invalidate,
    invalidationDiagnostics,
  }: {
    mutationFn: (args: TestArgs) => Result.ResultAsync<TestData, { message: string; type?: AppError["type"] }>;
    invalidate: (qc: QueryClient, args: TestArgs, data: TestData) => void | Promise<void>;
    invalidationDiagnostics?: Parameters<typeof createMutation<TestArgs, TestData>>[2];
  }) {
    const { queryClient, wrapper } = createQueryWrapper({
      queryClientConfig: { defaultOptions: { mutations: { retry: false } } },
    });
    const useGeneratedMutation = createMutation(mutationFn, invalidate, invalidationDiagnostics);
    const rendered = renderHook(() => useGeneratedMutation(), { wrapper });

    return { queryClient, ...rendered };
  }

  it("calls invalidate with unwrapped data after a successful mutation", async () => {
    const args = { id: "item-1" };
    const data = { savedId: "saved-1" };
    const mutationFn = vi.fn(async () => Result.succeed(data));
    const invalidate = vi.fn();
    const { queryClient, result } = renderGeneratedMutation({
      mutationFn,
      invalidate,
    });

    await expect(result.current.mutateAsync(args)).resolves.toEqual(data);

    expect(mutationFn).toHaveBeenCalledWith(args);
    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenCalledWith(queryClient, args, data);
  });

  it("does not call invalidate when the mutation returns Result.fail", async () => {
    const mutationFn = vi.fn(async () => Result.fail({ message: "boom" }));
    const invalidate = vi.fn();
    const { result } = renderGeneratedMutation({
      mutationFn,
      invalidate,
    });

    await expect(result.current.mutateAsync({ id: "item-1" })).rejects.toBeDefined();

    expect(invalidate).not.toHaveBeenCalled();
    expect(useUiStore.getState().toastMessage).toBeNull();
  });

  it("preserves AppError classification when the mutation returns Result.fail", async () => {
    const mutationFn = vi.fn(async () => Result.fail({ type: "Retryable", message: "network timeout" } as const));
    const invalidate = vi.fn();
    const { result } = renderGeneratedMutation({
      mutationFn,
      invalidate,
    });

    await expect(result.current.mutateAsync({ id: "item-1" })).rejects.toMatchObject({
      type: "Retryable",
      message: "network timeout",
    });

    expect(invalidate).not.toHaveBeenCalled();
    expect(useUiStore.getState().toastMessage).toBeNull();
  });

  it("does not call invalidate when the mutation throws", async () => {
    const mutationFn = vi.fn(async () => {
      throw new Error("boom");
    });
    const invalidate = vi.fn();
    const { result } = renderGeneratedMutation({
      mutationFn,
      invalidate,
    });

    await expect(result.current.mutateAsync({ id: "item-1" })).rejects.toThrow("boom");

    expect(invalidate).not.toHaveBeenCalled();
  });

  it("rejects without toast when invalidate throws after a successful mutation", async () => {
    const args = { id: "item-1" };
    const data = { savedId: "saved-1" };
    const mutationFn = vi.fn(async () => Result.succeed(data));
    const invalidateError = new Error("invalidate failed");
    const invalidate = vi.fn(() => {
      throw invalidateError;
    });
    const { result } = renderGeneratedMutation({
      mutationFn,
      invalidate,
    });

    await expect(result.current.mutateAsync(args)).rejects.toThrow("invalidate failed");

    expect(mutationFn).toHaveBeenCalledWith(args);
    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(useUiStore.getState().toastMessage).toBeNull();
  });

  it("rejects without toast when async invalidation rejects after a successful mutation", async () => {
    const args = { id: "item-1" };
    const data = { savedId: "saved-1" };
    const mutationFn = vi.fn(async () => Result.succeed(data));
    const invalidateError = new Error("async invalidate failed");
    const invalidate = vi.fn(async () => {
      throw invalidateError;
    });
    const { result } = renderGeneratedMutation({
      mutationFn,
      invalidate,
    });

    await expect(result.current.mutateAsync(args)).rejects.toThrow("async invalidate failed");

    expect(mutationFn).toHaveBeenCalledWith(args);
    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(useUiStore.getState().toastMessage).toBeNull();
  });

  it("emits invalidation diagnostics with owner and query keys when configured invalidation rejects", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const args = { id: "item-1" };
    const data = { savedId: "saved-1" };
    const mutationFn = vi.fn(async () => Result.succeed(data));
    const invalidateError = new Error("articles invalidate failed");
    const invalidate = vi.fn(async () => {
      throw invalidateError;
    });
    const { result } = renderGeneratedMutation({
      mutationFn,
      invalidate,
      invalidationDiagnostics: {
        actionOwner: "article-mutation",
        queryKeys: [["articles"], ["accountArticles"]],
      },
    });

    await expect(result.current.mutateAsync(args)).rejects.toThrow("articles invalidate failed");

    expect(warnSpy).toHaveBeenCalledWith("[createMutation] invalidation failed:", {
      actionOwner: "article-mutation",
      queryKeys: [["articles"], ["accountArticles"]],
      error: invalidateError,
    });
    expect(useUiStore.getState().toastMessage).toBeNull();
  });
});
