import { act, renderHook } from "@testing-library/react";
import { createTestQueryClient } from "@tests/helpers/create-wrapper";
import { sampleAccounts } from "@tests/helpers/fixtures";
import i18n from "@tests/helpers/i18n-setup";
import type { KeyboardEvent, RefObject } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAccountDetailNameEditor } from "@/components/settings/hooks/account-detail/use-account-detail-name-editor";

const { renameAccountMock } = vi.hoisted(() => ({
  renameAccountMock: vi.fn(),
}));

vi.mock("@/api/tauri-commands", () => ({
  renameAccount: renameAccountMock,
}));

describe("useAccountDetailNameEditor", () => {
  const t = i18n.getFixedT("en", "settings");

  beforeEach(() => {
    renameAccountMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.replaceChildren();
  });

  it("focuses and selects the name input when editing starts", () => {
    const account = { ...sampleAccounts[1], name: "FreshRSS" };
    const frameSpy = vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    const input = document.createElement("input");
    input.value = account.name;
    document.body.append(input);

    const { result } = renderHook(() =>
      useAccountDetailNameEditor({
        account,
        queryClient: createTestQueryClient(),
        t,
      }),
    );

    setInputRef(result.current.nameInputRef, input);

    act(() => {
      result.current.startEditingName();
    });

    expect(frameSpy).toHaveBeenCalled();
    expect(input).toHaveFocus();
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(account.name.length);
  });

  it("does not save a canceled draft when blur commits after Escape", async () => {
    const account = { ...sampleAccounts[1], name: "FreshRSS" };
    const { result } = renderHook(() =>
      useAccountDetailNameEditor({
        account,
        queryClient: createTestQueryClient(),
        t,
      }),
    );

    act(() => {
      result.current.startEditingName();
      result.current.setNameDraft("Canceled Name");
      result.current.handleNameKeyDown({
        key: "Escape",
        preventDefault: vi.fn(),
      } as unknown as KeyboardEvent<HTMLInputElement>);
    });

    await act(async () => {
      await result.current.commitRename();
    });

    expect(renameAccountMock).not.toHaveBeenCalled();
    expect(result.current.editingName).toBe(false);
  });
});

function setInputRef(ref: RefObject<HTMLInputElement | null>, input: HTMLInputElement): void {
  Object.defineProperty(ref, "current", {
    configurable: true,
    value: input,
  });
}
