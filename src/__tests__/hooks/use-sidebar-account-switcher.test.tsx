import { act, fireEvent, renderHook } from "@testing-library/react";
import type { MutableRefObject } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { useSidebarAccountSwitcher } from "@/components/reader/hooks/sidebar/use-sidebar-account-switcher";

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
});
