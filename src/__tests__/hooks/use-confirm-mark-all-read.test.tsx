import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useConfirmMarkAllRead } from "@/hooks/use-confirm-mark-all-read";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";

vi.mock("react-i18next", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-i18next")>();

  return {
    ...actual,
    useTranslation: (namespace: string) => ({
      t: (key: string, options?: { count?: number }) =>
        namespace === "reader" ? `${key}:${options?.count ?? ""}` : key,
    }),
  };
});

describe("useConfirmMarkAllRead", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useUiStore.setState(useUiStore.getInitialState());
    usePreferencesStore.setState({ prefs: {}, loaded: true });
  });

  it.each([
    0,
    -1,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
  ])("does not confirm or run the action for invalid count %s", (count) => {
    const onConfirm = vi.fn();
    const showConfirm = vi.fn();
    useUiStore.setState({ showConfirm });
    const { result } = renderHook(() => useConfirmMarkAllRead());

    act(() => {
      result.current({ count, onConfirm });
    });

    expect(showConfirm).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("opens a warning confirmation for a positive count when confirmation is enabled", () => {
    const onConfirm = vi.fn();
    const showConfirm = vi.fn();
    useUiStore.setState({ showConfirm });
    usePreferencesStore.setState({ prefs: { ask_before_mark_all: "true" }, loaded: true });
    const { result } = renderHook(() => useConfirmMarkAllRead());

    act(() => {
      result.current({ count: 3, onConfirm });
    });

    expect(showConfirm).toHaveBeenCalledWith("confirm_mark_read:3", onConfirm, {
      actionLabel: "mark_as_read_action",
      variant: "warning",
    });
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("runs the action directly for a positive count when confirmation is disabled", () => {
    const onConfirm = vi.fn();
    const showConfirm = vi.fn();
    useUiStore.setState({ showConfirm });
    usePreferencesStore.setState({ prefs: { ask_before_mark_all: "false" }, loaded: true });
    const { result } = renderHook(() => useConfirmMarkAllRead());

    act(() => {
      result.current({ count: 3, onConfirm });
    });

    expect(showConfirm).not.toHaveBeenCalled();
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
