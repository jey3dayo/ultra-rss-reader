import { Result } from "@praha/byethrow";
import type { QueryClient } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { createQueryWrapper } from "@tests/helpers/create-wrapper";
import { beforeEach, describe, expect, it, vi } from "vitest";
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

  function renderGeneratedMutation({
    mutationFn,
    invalidate,
  }: {
    mutationFn: (args: TestArgs) => Result.ResultAsync<TestData, { message: string }>;
    invalidate: (qc: QueryClient, args: TestArgs, data: TestData) => void;
  }) {
    const { queryClient, wrapper } = createQueryWrapper({
      queryClientConfig: { defaultOptions: { mutations: { retry: false } } },
    });
    const useGeneratedMutation = createMutation(mutationFn, invalidate);
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
});
