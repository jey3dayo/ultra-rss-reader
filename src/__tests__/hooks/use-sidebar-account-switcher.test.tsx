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

  it("restores focus to the trigger when closing with restoreFocus", () => {
    const trigger = document.createElement("button");
    const other = document.createElement("button");
    document.body.append(trigger, other);
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
    expect(trigger).toHaveFocus();
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
    const requestAnimationFrameSpy = vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
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
