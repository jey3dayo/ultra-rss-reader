import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MuteSettings } from "@/components/settings/mute-settings";
import { useUiStore } from "@/stores/ui-store";

const updateMuteKeywordMutateAsyncMock = vi.fn();
const createMuteKeywordMutateAsyncMock = vi.fn();
const deleteMuteKeywordMutateAsyncMock = vi.fn();
const setMuteAutoMarkReadMutateAsyncMock = vi.fn();
const initialMuteKeywordRules = [
  {
    id: "mute-1",
    keyword: "spoiler",
    scope: "title" as const,
    created_at: "2026-04-30T00:00:00.000Z",
    updated_at: "2026-04-30T00:00:00.000Z",
  },
  {
    id: "mute-2",
    keyword: "ending",
    scope: "body" as const,
    created_at: "2026-04-30T00:00:00.000Z",
    updated_at: "2026-04-30T00:00:00.000Z",
  },
];
let muteKeywordRules = [...initialMuteKeywordRules];

vi.mock("@/hooks/use-mute-keywords", () => ({
  useMuteKeywords: () => ({
    data: muteKeywordRules,
  }),
  useCreateMuteKeyword: () => ({
    isPending: false,
    mutateAsync: createMuteKeywordMutateAsyncMock,
  }),
  useDeleteMuteKeyword: () => ({
    isPending: false,
    mutateAsync: deleteMuteKeywordMutateAsyncMock,
  }),
  useSetMuteAutoMarkRead: () => ({
    isPending: false,
    mutateAsync: setMuteAutoMarkReadMutateAsyncMock,
  }),
  useUpdateMuteKeyword: () => ({
    isPending: false,
    mutateAsync: updateMuteKeywordMutateAsyncMock,
  }),
}));

function createDeferred<T>() {
  let resolve: (value: T) => void = () => {};
  let reject: (reason?: unknown) => void = () => {};
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
}

function getDeleteButtonAt(index: number): HTMLElement {
  return getElementAt(screen.getAllByRole("button", { name: "Delete" }), index, "delete button");
}

function getElementAt<T>(items: T[], index: number, label: string): T {
  const item = items[index];
  if (!item) {
    throw new Error(`expected ${label} at index ${index}`);
  }

  return item;
}

function getDeleteButtonFrom(buttons: HTMLElement[], index: number): HTMLElement {
  const button = buttons[index];
  if (!button) {
    throw new Error(`expected delete button at index ${index}`);
  }

  return button;
}

describe("MuteSettings", () => {
  beforeEach(() => {
    updateMuteKeywordMutateAsyncMock.mockReset();
    createMuteKeywordMutateAsyncMock.mockReset();
    deleteMuteKeywordMutateAsyncMock.mockReset();
    setMuteAutoMarkReadMutateAsyncMock.mockReset();
    updateMuteKeywordMutateAsyncMock.mockResolvedValue(undefined);
    createMuteKeywordMutateAsyncMock.mockResolvedValue(undefined);
    deleteMuteKeywordMutateAsyncMock.mockResolvedValue(undefined);
    setMuteAutoMarkReadMutateAsyncMock.mockResolvedValue(undefined);
    muteKeywordRules = [...initialMuteKeywordRules];
    useUiStore.setState(useUiStore.getInitialState());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not update or toast when a saved rule scope is unchanged", async () => {
    const user = userEvent.setup();
    const showToast = vi.fn();
    useUiStore.setState({ showToast });

    render(<MuteSettings />);

    await user.click(screen.getByRole("combobox", { name: "Scope for spoiler" }));
    await user.click(await screen.findByRole("option", { name: "Title" }));

    expect(updateMuteKeywordMutateAsyncMock).not.toHaveBeenCalled();
    expect(showToast).not.toHaveBeenCalled();
  });

  it("does not update or toast when the draft scope selection is unchanged", async () => {
    const user = userEvent.setup();
    const showToast = vi.fn();
    useUiStore.setState({ showToast });

    render(<MuteSettings />);

    await user.click(screen.getByRole("combobox", { name: "Scope" }));
    await user.click(await screen.findByRole("option", { name: "Title and body" }));

    expect(createMuteKeywordMutateAsyncMock).not.toHaveBeenCalled();
    expect(updateMuteKeywordMutateAsyncMock).not.toHaveBeenCalled();
    expect(showToast).not.toHaveBeenCalled();
  });

  it("resets the add draft after creating a mute keyword", async () => {
    const user = userEvent.setup();
    const showToast = vi.fn();
    useUiStore.setState({ showToast });

    render(<MuteSettings />);

    await user.type(screen.getByRole("textbox", { name: "Keyword" }), "spoiler alert");
    await user.click(screen.getByRole("combobox", { name: "Scope" }));
    await user.click(await screen.findByRole("option", { name: "Body" }));
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => {
      expect(createMuteKeywordMutateAsyncMock).toHaveBeenCalledWith({
        keyword: "spoiler alert",
        scope: "body",
      });
    });
    expect(screen.getByRole("textbox", { name: "Keyword" })).toHaveValue("");
    expect(screen.getByRole("combobox", { name: "Scope" })).toHaveTextContent("Body");
  });

  it("keeps the add draft when mute keyword creation fails", async () => {
    const user = userEvent.setup();
    createMuteKeywordMutateAsyncMock.mockRejectedValueOnce(new Error("create failed"));

    render(<MuteSettings />);

    await user.type(screen.getByRole("textbox", { name: "Keyword" }), "spoiler alert");
    await user.click(screen.getByRole("combobox", { name: "Scope" }));
    await user.click(await screen.findByRole("option", { name: "Body" }));
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => {
      expect(createMuteKeywordMutateAsyncMock).toHaveBeenCalledWith({
        keyword: "spoiler alert",
        scope: "body",
      });
    });
    expect(screen.getByRole("textbox", { name: "Keyword" })).toHaveValue("spoiler alert");
    expect(screen.getByRole("combobox", { name: "Scope" })).toHaveTextContent("Body");
  });

  it("submits mute keyword creation from the keyword input with Enter", async () => {
    const user = userEvent.setup();

    render(<MuteSettings />);

    await user.type(screen.getByRole("textbox", { name: "Keyword" }), "spoiler alert{Enter}");

    await waitFor(() => {
      expect(createMuteKeywordMutateAsyncMock).toHaveBeenCalledWith({
        keyword: "spoiler alert",
        scope: "title_and_body",
      });
    });
  });

  it("guards mute keyword creation from repeated submits before pending state is reflected", async () => {
    const user = userEvent.setup();
    const pendingCreate = createDeferred<void>();
    createMuteKeywordMutateAsyncMock.mockReturnValueOnce(pendingCreate.promise);

    render(<MuteSettings />);

    const keywordInput = screen.getByRole("textbox", { name: "Keyword" });
    await user.type(keywordInput, "spoiler alert");
    const form = keywordInput.closest("form");
    const addButton = screen.getByRole("button", { name: "Add" });

    if (!form) {
      throw new Error("Expected mute keyword input to be inside a form");
    }

    fireEvent.click(addButton);
    fireEvent.submit(form);

    expect(createMuteKeywordMutateAsyncMock).toHaveBeenCalledTimes(1);
    expect(createMuteKeywordMutateAsyncMock).toHaveBeenCalledWith({
      keyword: "spoiler alert",
      scope: "title_and_body",
    });

    await act(async () => {
      pendingCreate.resolve();
      await pendingCreate.promise;
    });
  });

  it("ignores short mute keyword submits even if the form submit event fires", async () => {
    const user = userEvent.setup();

    render(<MuteSettings />);

    const keywordInput = screen.getByRole("textbox", { name: "Keyword" });
    await user.type(keywordInput, "ai");
    const form = keywordInput.closest("form");

    if (!form) {
      throw new Error("Expected mute keyword input to be inside a form");
    }

    fireEvent.submit(form);

    expect(createMuteKeywordMutateAsyncMock).not.toHaveBeenCalled();
  });

  it("trims mute keyword creation input and rejects whitespace-padded short values", async () => {
    const user = userEvent.setup();

    render(<MuteSettings />);

    const keywordInput = screen.getByRole("textbox", { name: "Keyword" });
    const addButton = screen.getByRole("button", { name: "Add" });

    await user.type(keywordInput, "  ai  ");

    expect(addButton).toBeDisabled();

    await user.clear(keywordInput);
    await user.type(keywordInput, "  spoiler  ");
    await user.click(addButton);

    await waitFor(() => {
      expect(createMuteKeywordMutateAsyncMock).toHaveBeenCalledWith({
        keyword: "spoiler",
        scope: "title_and_body",
      });
    });
  });

  it("updates a saved rule scope when the edit selection changes", async () => {
    const user = userEvent.setup();
    const showToast = vi.fn();
    useUiStore.setState({ showToast });

    render(<MuteSettings />);

    await user.click(screen.getByRole("combobox", { name: "Scope for spoiler" }));
    await user.click(await screen.findByRole("option", { name: "Body" }));

    await waitFor(() => {
      expect(updateMuteKeywordMutateAsyncMock).toHaveBeenCalledWith({
        muteKeywordId: "mute-1",
        scope: "body",
      });
    });
  });

  it("ignores stale saved rule scope update success after a newer change", async () => {
    const user = userEvent.setup();
    const showToast = vi.fn();
    useUiStore.setState({ showToast });
    const firstUpdate = createDeferred<void>();
    const secondUpdate = createDeferred<void>();
    updateMuteKeywordMutateAsyncMock.mockReturnValueOnce(firstUpdate.promise).mockReturnValueOnce(secondUpdate.promise);

    render(<MuteSettings />);

    await user.click(screen.getByRole("combobox", { name: "Scope for spoiler" }));
    await user.click(await screen.findByRole("option", { name: "Body" }));
    await user.click(screen.getByRole("combobox", { name: "Scope for spoiler" }));
    await user.click(await screen.findByRole("option", { name: "Title and body" }));

    await waitFor(() => {
      expect(updateMuteKeywordMutateAsyncMock).toHaveBeenCalledTimes(2);
    });
    expect(updateMuteKeywordMutateAsyncMock).toHaveBeenNthCalledWith(1, {
      muteKeywordId: "mute-1",
      scope: "body",
    });
    expect(updateMuteKeywordMutateAsyncMock).toHaveBeenNthCalledWith(2, {
      muteKeywordId: "mute-1",
      scope: "title_and_body",
    });

    await act(async () => {
      secondUpdate.resolve();
      await secondUpdate.promise;
    });
    expect(showToast).toHaveBeenCalledTimes(1);

    await act(async () => {
      firstUpdate.resolve();
      await firstUpdate.promise;
    });
    expect(showToast).toHaveBeenCalledTimes(1);
  });

  it("ignores stale saved rule scope update failure after a newer change", async () => {
    const user = userEvent.setup();
    const showToast = vi.fn();
    useUiStore.setState({ showToast });
    const firstUpdate = createDeferred<void>();
    const secondUpdate = createDeferred<void>();
    updateMuteKeywordMutateAsyncMock.mockReturnValueOnce(firstUpdate.promise).mockReturnValueOnce(secondUpdate.promise);

    render(<MuteSettings />);

    await user.click(screen.getByRole("combobox", { name: "Scope for spoiler" }));
    await user.click(await screen.findByRole("option", { name: "Body" }));
    await user.click(screen.getByRole("combobox", { name: "Scope for spoiler" }));
    await user.click(await screen.findByRole("option", { name: "Title and body" }));

    await waitFor(() => {
      expect(updateMuteKeywordMutateAsyncMock).toHaveBeenCalledTimes(2);
    });

    await act(async () => {
      secondUpdate.resolve();
      await secondUpdate.promise;
    });
    expect(showToast).toHaveBeenCalledTimes(1);

    await act(async () => {
      firstUpdate.reject(new Error("first failed"));
      await firstUpdate.promise.catch(() => undefined);
    });
    expect(showToast).toHaveBeenCalledTimes(1);
    expect(showToast).not.toHaveBeenCalledWith(expect.stringContaining("first failed"));
  });

  it("opens and cancels the delete confirmation without deleting", async () => {
    const user = userEvent.setup();

    render(<MuteSettings />);

    await user.click(getDeleteButtonAt(0));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getAllByText(/spoiler/).length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(deleteMuteKeywordMutateAsyncMock).not.toHaveBeenCalled();
  });

  it("retargets the delete confirmation when another saved rule is requested", async () => {
    const user = userEvent.setup();

    render(<MuteSettings />);

    const deleteButtons = screen.getAllByRole("button", { name: "Delete" });
    await user.click(getDeleteButtonAt(0));
    expect(within(screen.getByRole("dialog")).getAllByText(/spoiler/).length).toBeGreaterThan(0);

    await user.click(getDeleteButtonFrom(deleteButtons, 1));
    expect(within(screen.getByRole("dialog")).getAllByText(/ending/).length).toBeGreaterThan(0);
    expect(within(screen.getByRole("dialog")).queryByText(/spoiler/)).not.toBeInTheDocument();
    expect(deleteMuteKeywordMutateAsyncMock).not.toHaveBeenCalled();
  });

  it("confirms delete and closes the delete confirmation", async () => {
    const user = userEvent.setup();
    const showToast = vi.fn();
    useUiStore.setState({ showToast });

    render(<MuteSettings />);

    await user.click(getDeleteButtonAt(0));
    const deleteButtons = screen.getAllByRole("button", { name: "Delete" });
    const confirmDeleteButton = getElementAt(deleteButtons, deleteButtons.length - 1, "delete confirmation button");

    await user.click(confirmDeleteButton);

    await waitFor(() => {
      expect(deleteMuteKeywordMutateAsyncMock).toHaveBeenCalledWith({
        muteKeywordId: "mute-1",
      });
    });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("closes stale delete confirmation without deleting when the target rule disappears", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<MuteSettings />);

    await user.click(getDeleteButtonAt(0));
    expect(within(screen.getByRole("dialog")).getAllByText(/spoiler/).length).toBeGreaterThan(0);

    muteKeywordRules = [getElementAt(initialMuteKeywordRules, 1, "initial mute keyword rule")];
    rerender(<MuteSettings />);

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(deleteMuteKeywordMutateAsyncMock).not.toHaveBeenCalled();
  });

  it("keeps the delete target snapshot and ignores duplicate confirms while deletion is pending", async () => {
    const user = userEvent.setup();
    const pendingDelete = createDeferred<void>();
    deleteMuteKeywordMutateAsyncMock.mockReturnValueOnce(pendingDelete.promise);

    render(<MuteSettings />);

    await user.click(getDeleteButtonAt(0));
    const deleteButtons = screen.getAllByRole("button", { name: "Delete" });
    const confirmDeleteButton = getElementAt(deleteButtons, deleteButtons.length - 1, "delete confirmation button");

    await user.click(confirmDeleteButton);
    expect(confirmDeleteButton).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();

    await user.click(confirmDeleteButton);
    expect(deleteMuteKeywordMutateAsyncMock).toHaveBeenCalledTimes(1);
    expect(deleteMuteKeywordMutateAsyncMock).toHaveBeenCalledWith({
      muteKeywordId: "mute-1",
    });

    await act(async () => {
      pendingDelete.resolve();
      await pendingDelete.promise;
    });
  });

  it("keeps the delete confirmation open when deletion fails", async () => {
    const user = userEvent.setup();
    deleteMuteKeywordMutateAsyncMock.mockRejectedValueOnce(new Error("delete failed"));

    render(<MuteSettings />);

    await user.click(getDeleteButtonAt(0));
    const deleteButtons = screen.getAllByRole("button", { name: "Delete" });
    const confirmDeleteButton = getElementAt(deleteButtons, deleteButtons.length - 1, "delete confirmation button");

    await user.click(confirmDeleteButton);

    await waitFor(() => {
      expect(deleteMuteKeywordMutateAsyncMock).toHaveBeenCalledWith({
        muteKeywordId: "mute-1",
      });
    });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(within(screen.getByRole("dialog")).getAllByText(/spoiler/).length).toBeGreaterThan(0);
  });

  it("does not let an older failed auto-mark update roll back a newer successful value", async () => {
    const user = userEvent.setup();
    const showToast = vi.fn();
    useUiStore.setState({ showToast });
    const firstUpdate = createDeferred<void>();
    const secondUpdate = createDeferred<void>();
    setMuteAutoMarkReadMutateAsyncMock
      .mockReturnValueOnce(firstUpdate.promise)
      .mockReturnValueOnce(secondUpdate.promise);

    render(<MuteSettings />);

    const switchControl = screen.getByRole("switch", {
      name: "Auto mark as read",
    });
    await user.click(switchControl);
    await user.click(switchControl);

    await waitFor(() => {
      expect(setMuteAutoMarkReadMutateAsyncMock).toHaveBeenCalledTimes(2);
    });
    expect(setMuteAutoMarkReadMutateAsyncMock).toHaveBeenNthCalledWith(1, {
      enabled: true,
    });
    expect(setMuteAutoMarkReadMutateAsyncMock).toHaveBeenNthCalledWith(2, {
      enabled: false,
    });

    await act(async () => {
      secondUpdate.resolve();
      await secondUpdate.promise;
    });
    await act(async () => {
      firstUpdate.reject(new Error("first failed"));
      await firstUpdate.promise.catch(() => undefined);
    });

    expect(switchControl).not.toBeChecked();
    expect(showToast).not.toHaveBeenCalledWith(expect.stringContaining("first failed"));
  });
});
