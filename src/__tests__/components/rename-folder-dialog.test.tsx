import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createQueryWrapper } from "@tests/helpers/create-wrapper";
import { createDeferred } from "@tests/helpers/deferred";
import { setupTauriMocks, teardownTauriMocks } from "@tests/helpers/tauri-mocks";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FolderDto } from "@/api/tauri-commands";
import { RenameFolderDialog } from "@/components/reader/rename-folder-dialog";
import { queryKeys } from "@/lib/query/query-keys";

const folder: FolderDto = { id: "folder-1", account_id: "acc-1", name: "Work", sort_order: 2 };

afterEach(() => {
  teardownTauriMocks();
  vi.restoreAllMocks();
});

describe("RenameFolderDialog", () => {
  it("saves a trimmed name once and preserves the folder identity and order in cache", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const save = createDeferred<null>();
    const calls = vi.fn();
    setupTauriMocks((command, args) => {
      calls(command, args);
      return save.promise;
    });
    const { wrapper, queryClient } = createQueryWrapper();
    const key = [...queryKeys.folders.root, folder.account_id];
    queryClient.setQueryData(key, [folder]);
    render(<RenameFolderDialog folder={folder} onClose={onClose} />, { wrapper });
    const input = screen.getByRole("textbox", { name: "Name" });
    await waitFor(() => expect(input).toHaveFocus());
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    await user.clear(input);
    await user.type(input, "  Reading  ");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await user.keyboard("{Enter}{Escape}");
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(onClose).not.toHaveBeenCalled();
    expect(calls).toHaveBeenCalledExactlyOnceWith("rename_folder", { folderId: folder.id, name: "Reading" });
    save.resolve(null);
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(queryClient.getQueryData(key)).toEqual([{ ...folder, name: "Reading" }]);
  });

  it("keeps a failed draft open with an accessible inline error and supports retry", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    let fail = true;
    vi.spyOn(console, "error").mockImplementation(() => {});
    setupTauriMocks(() => {
      if (fail) throw { type: "UserVisible", message: "Folder name already exists" };
      return null;
    });
    const { wrapper, queryClient } = createQueryWrapper();
    const key = [...queryKeys.folders.root, folder.account_id];
    queryClient.setQueryData(key, [folder]);
    render(<RenameFolderDialog folder={folder} onClose={onClose} />, { wrapper });
    const input = screen.getByRole("textbox", { name: "Name" });
    await user.clear(input);
    await user.type(input, "Existing");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Folder name already exists");
    expect(input).toHaveAccessibleDescription(/Folder name already exists/);
    expect(input).toHaveValue("Existing");
    expect(onClose).not.toHaveBeenCalled();
    expect(queryClient.getQueryData(key)).toEqual([folder]);
    fail = false;
    await user.clear(input);
    await user.type(input, "Unique");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });

  it("disables blank names and cancels without saving", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const calls = vi.fn();
    setupTauriMocks(calls);
    const { wrapper } = createQueryWrapper();
    render(<RenameFolderDialog folder={folder} onClose={onClose} />, { wrapper });
    await user.clear(screen.getByRole("textbox", { name: "Name" }));
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(calls).not.toHaveBeenCalled();
  });
});
