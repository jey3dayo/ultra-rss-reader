import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MuteSettings } from "@/components/settings/mute-settings";
import { useUiStore } from "@/stores/ui-store";

const updateMuteKeywordMutateAsyncMock = vi.fn();
const createMuteKeywordMutateAsyncMock = vi.fn();
const deleteMuteKeywordMutateAsyncMock = vi.fn();

vi.mock("@/hooks/use-mute-keywords", () => ({
  useMuteKeywords: () => ({
    data: [
      {
        id: "mute-1",
        keyword: "spoiler",
        scope: "title",
        created_at: "2026-04-30T00:00:00.000Z",
        updated_at: "2026-04-30T00:00:00.000Z",
      },
    ],
  }),
  useCreateMuteKeyword: () => ({
    isPending: false,
    mutateAsync: createMuteKeywordMutateAsyncMock,
  }),
  useDeleteMuteKeyword: () => ({
    isPending: false,
    mutateAsync: deleteMuteKeywordMutateAsyncMock,
  }),
  useSetMuteAutoMarkRead: () => ({ isPending: false, mutateAsync: vi.fn() }),
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

describe("MuteSettings", () => {
  beforeEach(() => {
    updateMuteKeywordMutateAsyncMock.mockReset();
    createMuteKeywordMutateAsyncMock.mockReset();
    deleteMuteKeywordMutateAsyncMock.mockReset();
    updateMuteKeywordMutateAsyncMock.mockResolvedValue(undefined);
    createMuteKeywordMutateAsyncMock.mockResolvedValue(undefined);
    deleteMuteKeywordMutateAsyncMock.mockResolvedValue(undefined);
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
    await user.click(await screen.findByRole("option", { name: "mute.scope_body" }));
    await user.click(screen.getByRole("combobox", { name: "Scope for spoiler" }));
    await user.click(await screen.findByRole("option", { name: "mute.scope_title_and_body" }));

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

  it("opens and cancels the delete confirmation without deleting", async () => {
    const user = userEvent.setup();

    render(<MuteSettings />);

    await user.click(screen.getByRole("button", { name: "Delete" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getAllByText(/spoiler/).length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(deleteMuteKeywordMutateAsyncMock).not.toHaveBeenCalled();
  });

  it("confirms delete and closes the delete confirmation", async () => {
    const user = userEvent.setup();
    const showToast = vi.fn();
    useUiStore.setState({ showToast });

    render(<MuteSettings />);

    await user.click(screen.getByRole("button", { name: "Delete" }));
    const deleteButtons = screen.getAllByRole("button", { name: "Delete" });
    const confirmDeleteButton = deleteButtons[deleteButtons.length - 1];
    if (!confirmDeleteButton) {
      throw new Error("expected delete confirmation button");
    }

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
});
