import { Result } from "@praha/byethrow";
import { act, renderHook } from "@testing-library/react";
import { createTestQueryClient } from "@tests/helpers/create-wrapper";
import { createDeferred } from "@tests/helpers/deferred";
import { sampleAccounts } from "@tests/helpers/fixtures";
import i18n from "@tests/helpers/i18n-setup";
import { createInputKeyboardEvent } from "@tests/helpers/typed-test-factories";
import type { RefObject } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { scheduleAccountDetailInputFocus } from "@/components/settings/hooks/account-detail/account-detail-editor-focus";
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
    vi.useRealTimers();
    vi.unstubAllGlobals();
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

  it("cancels a scheduled name input focus when the editor unmounts", () => {
    const account = { ...sampleAccounts[1], name: "FreshRSS" };
    let runScheduledFrame: FrameRequestCallback = () => {};
    const frameSpy = vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      runScheduledFrame = callback;
      return 1;
    });
    const cancelFrameSpy = vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
    const input = document.createElement("input");
    input.value = account.name;
    document.body.append(input);

    const { result, unmount } = renderHook(() =>
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
    unmount();
    runScheduledFrame(0);

    expect(frameSpy).toHaveBeenCalled();
    expect(cancelFrameSpy).toHaveBeenCalledWith(1);
    expect(input).not.toHaveFocus();
  });

  it("focuses the latest name input ref when a scheduled focus frame runs", () => {
    const account = { ...sampleAccounts[1], name: "FreshRSS" };
    let runScheduledFrame: FrameRequestCallback = () => {};
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      runScheduledFrame = callback;
      return 1;
    });
    const firstInput = document.createElement("input");
    const secondInput = document.createElement("input");
    firstInput.value = "First";
    secondInput.value = "Second";
    document.body.append(firstInput, secondInput);

    const { result } = renderHook(() =>
      useAccountDetailNameEditor({
        account,
        queryClient: createTestQueryClient(),
        t,
      }),
    );

    setInputRef(result.current.nameInputRef, firstInput);
    act(() => {
      result.current.startEditingName();
    });
    setInputRef(result.current.nameInputRef, secondInput);
    runScheduledFrame(0);

    expect(secondInput).toHaveFocus();
    expect(firstInput).not.toHaveFocus();
  });

  it("falls back to a timer when requestAnimationFrame is unavailable", () => {
    vi.useFakeTimers();
    vi.stubGlobal("requestAnimationFrame", undefined);
    vi.stubGlobal("cancelAnimationFrame", undefined);
    const input = document.createElement("input");
    input.value = "FreshRSS";
    document.body.append(input);

    scheduleAccountDetailInputFocus({ current: input });
    vi.runOnlyPendingTimers();

    expect(input).toHaveFocus();
    vi.useRealTimers();
    vi.unstubAllGlobals();
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
      result.current.handleNameKeyDown(
        createInputKeyboardEvent({
          key: "Escape",
          preventDefault: vi.fn(),
        }),
      );
    });

    await act(async () => {
      await result.current.commitRename();
    });

    expect(renameAccountMock).not.toHaveBeenCalled();
    expect(result.current.editingName).toBe(false);
  });

  it("does not save a canceled draft when blur uses the pre-Escape commit handler", async () => {
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
    });

    const blurCommitFromFocusedInput = result.current.commitRename;

    act(() => {
      result.current.handleNameKeyDown(
        createInputKeyboardEvent({
          key: "Escape",
          preventDefault: vi.fn(),
        }),
      );
    });

    await act(async () => {
      await blurCommitFromFocusedInput();
    });

    expect(renameAccountMock).not.toHaveBeenCalled();
    expect(result.current.editingName).toBe(false);
  });

  it("keeps the editor open and clears saving state when rename fails", async () => {
    const account = { ...sampleAccounts[1], name: "FreshRSS" };
    renameAccountMock.mockResolvedValue(Result.fail({ message: "network down" }));
    const { result } = renderHook(() =>
      useAccountDetailNameEditor({
        account,
        queryClient: createTestQueryClient(),
        t,
      }),
    );

    act(() => {
      result.current.startEditingName();
      result.current.setNameDraft("FreshRSS Personal");
    });
    await act(async () => {
      await result.current.commitRename();
    });

    expect(renameAccountMock).toHaveBeenCalledWith(account.id, "FreshRSS Personal");
    expect(result.current.editingName).toBe(true);
    expect(result.current.savingName).toBe(false);
    expect(result.current.nameDraft).toBe("FreshRSS Personal");
  });

  it("ignores a stale rename response after switching accounts and starting a new edit", async () => {
    const firstAccount = { ...sampleAccounts[1], id: "acc-1", name: "FreshRSS Work" };
    const secondAccount = { ...sampleAccounts[2], id: "acc-2", name: "Local Account" };
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(["accounts"], [firstAccount, secondAccount]);
    const staleRename = createDeferred<ReturnType<typeof renameAccountMock>>();
    renameAccountMock.mockReturnValue(staleRename.promise);

    const { result, rerender } = renderHook(
      ({ account }) =>
        useAccountDetailNameEditor({
          account,
          queryClient,
          t,
        }),
      { initialProps: { account: firstAccount } },
    );

    act(() => {
      result.current.startEditingName();
      result.current.setNameDraft("Stale Name");
    });
    const saveStaleRename = result.current.commitRename();

    rerender({ account: secondAccount });
    act(() => {
      result.current.startEditingName();
      result.current.setNameDraft("Current Draft");
    });

    await act(async () => {
      staleRename.resolve(Result.succeed({ ...firstAccount, name: "Stale Name" }));
      await saveStaleRename;
    });

    expect(queryClient.getQueryData(["accounts"])).toEqual([firstAccount, secondAccount]);
    expect(result.current.editingName).toBe(true);
    expect(result.current.savingName).toBe(false);
    expect(result.current.nameDraft).toBe("Current Draft");
  });

  it("clears saving state when a stale rename response arrives after switching accounts", async () => {
    const firstAccount = { ...sampleAccounts[1], id: "acc-1", name: "FreshRSS Work" };
    const secondAccount = { ...sampleAccounts[2], id: "acc-2", name: "Local Account" };
    const staleRename = createDeferred<ReturnType<typeof renameAccountMock>>();
    renameAccountMock.mockReturnValue(staleRename.promise);

    const { result, rerender } = renderHook(
      ({ account }) =>
        useAccountDetailNameEditor({
          account,
          queryClient: createTestQueryClient(),
          t,
        }),
      { initialProps: { account: firstAccount } },
    );

    act(() => {
      result.current.startEditingName();
      result.current.setNameDraft("Stale Name");
    });
    let saveStaleRename: Promise<void> = Promise.resolve();
    act(() => {
      saveStaleRename = result.current.commitRename();
    });

    expect(result.current.savingName).toBe(true);

    rerender({ account: secondAccount });

    await act(async () => {
      staleRename.resolve(Result.succeed({ ...firstAccount, name: "Stale Name" }));
      await saveStaleRename;
    });

    expect(result.current.savingName).toBe(false);
    expect(result.current.nameDraft).toBe("Stale Name");
  });
});

function setInputRef(ref: RefObject<HTMLInputElement | null>, input: HTMLInputElement): void {
  Object.defineProperty(ref, "current", {
    configurable: true,
    value: input,
  });
}
