import { Result } from "@praha/byethrow";
import { renderHook, waitFor } from "@testing-library/react";
import { createQueryWrapper } from "@tests/helpers/create-wrapper";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createQuery } from "@/hooks/create-query";

describe("createQuery", () => {
  let wrapper: ReturnType<typeof createQueryWrapper>["wrapper"];
  type GeneratedQueryProps = { id: string | null };

  beforeEach(() => {
    const queryWrapper = createQueryWrapper();
    wrapper = queryWrapper.wrapper;
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
    expect(fetcher).not.toHaveBeenCalled();

    rerender({ id: "item-1" });

    await waitFor(() => {
      expect(result.current.data).toEqual({ id: "item-1" });
    });
    expect(fetcher).toHaveBeenCalledWith("item-1");
  });
});
