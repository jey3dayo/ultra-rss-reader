import { act, fireEvent, renderHook } from "@testing-library/react";
import { sampleAccounts } from "@tests/helpers/fixtures";
import type { MutableRefObject } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  useAccountSwitcherViewModel,
  useSidebarAccountSwitcher,
} from "@/components/reader/hooks/sidebar/use-sidebar-account-switcher";

function setRef<T>(ref: unknown, value: T) {
  (ref as MutableRefObject<T>).current = value;
}

describe("useSidebarAccountSwitcher", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("toggles the account list open state", () => {
    const { result } = renderHook(() => useSidebarAccountSwitcher());

    expect(result.current.isAccountListOpen).toBe(false);

    act(() => {
      result.current.toggleAccountList();
    });
    expect(result.current.isAccountListOpen).toBe(true);

    act(() => {
      result.current.toggleAccountList();
    });
    expect(result.current.isAccountListOpen).toBe(false);
  });

  it("closes the account list on outside mousedown", () => {
    const dropdown = document.createElement("div");
    const outside = document.createElement("button");
    document.body.append(dropdown, outside);
    const { result } = renderHook(() => useSidebarAccountSwitcher());
    setRef(result.current.accountDropdownRef, dropdown);

    act(() => {
      result.current.toggleAccountList();
    });
    expect(result.current.isAccountListOpen).toBe(true);

    fireEvent.mouseDown(outside);

    expect(result.current.isAccountListOpen).toBe(false);
  });

  it("closes the account list on outside pointer, touch, and focus transitions", () => {
    const dropdown = document.createElement("div");
    const inside = document.createElement("button");
    const outside = document.createElement("button");
    dropdown.append(inside);
    document.body.append(dropdown, outside);
    const { result } = renderHook(() => useSidebarAccountSwitcher());
    setRef(result.current.accountDropdownRef, dropdown);

    act(() => {
      result.current.toggleAccountList();
    });
    fireEvent.pointerDown(outside);
    expect(result.current.isAccountListOpen).toBe(false);

    act(() => {
      result.current.toggleAccountList();
    });
    fireEvent.touchStart(outside);
    expect(result.current.isAccountListOpen).toBe(false);

    act(() => {
      result.current.toggleAccountList();
    });
    fireEvent.focusOut(inside, { relatedTarget: outside });
    expect(result.current.isAccountListOpen).toBe(false);
  });

  it("keeps the account list open on inside mousedown", () => {
    const dropdown = document.createElement("div");
    const item = document.createElement("button");
    dropdown.append(item);
    document.body.append(dropdown);
    const { result } = renderHook(() => useSidebarAccountSwitcher());
    setRef(result.current.accountDropdownRef, dropdown);

    act(() => {
      result.current.toggleAccountList();
    });
    expect(result.current.isAccountListOpen).toBe(true);

    fireEvent.mouseDown(item);

    expect(result.current.isAccountListOpen).toBe(true);
  });

  it("keeps the account list open on inside pointer, touch, and focus transitions", () => {
    const dropdown = document.createElement("div");
    const firstItem = document.createElement("button");
    const secondItem = document.createElement("button");
    dropdown.append(firstItem, secondItem);
    document.body.append(dropdown);
    const { result } = renderHook(() => useSidebarAccountSwitcher());
    setRef(result.current.accountDropdownRef, dropdown);

    act(() => {
      result.current.toggleAccountList();
    });
    fireEvent.pointerDown(firstItem);
    expect(result.current.isAccountListOpen).toBe(true);

    fireEvent.touchStart(firstItem);
    expect(result.current.isAccountListOpen).toBe(true);

    fireEvent.focusOut(firstItem, { relatedTarget: secondItem });
    expect(result.current.isAccountListOpen).toBe(true);
  });

  it("restores focus to the trigger when closing with restoreFocus", () => {
    const scheduledCallbacks: FrameRequestCallback[] = [];
    const trigger = document.createElement("button");
    const other = document.createElement("button");
    document.body.append(trigger, other);
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      scheduledCallbacks.push(callback);
      return 1;
    });
    const { result } = renderHook(() => useSidebarAccountSwitcher());
    setRef(result.current.accountTriggerRef, trigger);
    other.focus();

    act(() => {
      result.current.toggleAccountList();
    });
    expect(result.current.isAccountListOpen).toBe(true);

    act(() => {
      result.current.closeAccountList(true);
    });

    expect(result.current.isAccountListOpen).toBe(false);
    scheduledCallbacks[0]?.(0);
    expect(trigger).toHaveFocus();
  });

  it("cancels restore focus when the account list reopens before the focus frame runs", () => {
    const scheduledCallbacks: FrameRequestCallback[] = [];
    const trigger = document.createElement("button");
    const other = document.createElement("button");
    document.body.append(trigger, other);
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      scheduledCallbacks.push(callback);
      return 88;
    });
    const cancelAnimationFrameSpy = vi
      .spyOn(window, "cancelAnimationFrame")
      .mockImplementation(() => undefined);
    const focusSpy = vi.spyOn(trigger, "focus");
    const { result } = renderHook(() => useSidebarAccountSwitcher());
    setRef(result.current.accountTriggerRef, trigger);
    other.focus();

    act(() => {
      result.current.toggleAccountList();
      result.current.closeAccountList(true);
    });
    expect(result.current.isAccountListOpen).toBe(false);

    act(() => {
      result.current.toggleAccountList();
    });

    expect(scheduledCallbacks).toHaveLength(1);
    expect(cancelAnimationFrameSpy).toHaveBeenCalledWith(88);
    expect(focusSpy).not.toHaveBeenCalled();
  });

  it("keeps the account list mounted when outside-click listener binding fails", () => {
    const error = new Error("document listener blocked");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(document, "addEventListener").mockImplementation(
      (type, listener, options) => {
        if (type === "mousedown" || type === "pointerdown") {
          throw error;
        }

        return EventTarget.prototype.addEventListener.call(
          document,
          type,
          listener,
          options,
        );
      },
    );
    const { result } = renderHook(() => useSidebarAccountSwitcher());

    expect(() => {
      act(() => {
        result.current.toggleAccountList();
      });
    }).not.toThrow();

    expect(result.current.isAccountListOpen).toBe(true);
    expect(warn).toHaveBeenCalledWith(
      "Failed to bind sidebar account switcher outside-click listener.",
      error,
    );
  });

  it("resolves the fallback title when the selected account is missing", () => {
    const { result } = renderHook(() =>
      useAccountSwitcherViewModel({
        accounts: sampleAccounts,
        selectedAccountId: "missing-account",
        isExpanded: false,
        itemRefs: { current: [] },
      }),
    );

    expect(result.current.selectedAccountName).toBeNull();
    expect(result.current.selectedIndex).toBe(-1);
    expect(result.current.hasMultipleAccounts).toBe(false);
    expect(result.current.canOpenAccountList).toBe(false);
  });

  it("keeps a single selected account closed without menu semantics", () => {
    const { result } = renderHook(() =>
      useAccountSwitcherViewModel({
        accounts: [sampleAccounts[0]],
        selectedAccountId: "acc-1",
        isExpanded: true,
        itemRefs: { current: [] },
      }),
    );

    expect(result.current.selectedAccountName).toBe("Local");
    expect(result.current.selectedIndex).toBe(0);
    expect(result.current.hasMultipleAccounts).toBe(false);
    expect(result.current.canOpenAccountList).toBe(false);
  });

  it("resolves multiple account menu state from the selected account", () => {
    const { result } = renderHook(() =>
      useAccountSwitcherViewModel({
        accounts: sampleAccounts,
        selectedAccountId: "acc-2",
        isExpanded: false,
        itemRefs: { current: [] },
      }),
    );

    expect(result.current.selectedAccountName).toBe("FreshRSS");
    expect(result.current.selectedIndex).toBe(1);
    expect(result.current.hasMultipleAccounts).toBe(true);
    expect(result.current.canOpenAccountList).toBe(true);
  });

  it("focuses the selected account item on the opened focus frame", () => {
    const firstItem = document.createElement("button");
    const secondItem = document.createElement("button");
    const itemRefs = { current: [firstItem, secondItem] };
    const requestAnimationFrameSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback) => {
        callback(0);
        return 0;
      });

    document.body.append(firstItem, secondItem);

    const { unmount } = renderHook(() =>
      useAccountSwitcherViewModel({
        accounts: sampleAccounts,
        selectedAccountId: "acc-2",
        isExpanded: true,
        itemRefs,
      }),
    );

    expect(secondItem).toHaveFocus();

    unmount();
    requestAnimationFrameSpy.mockRestore();
  });
});
