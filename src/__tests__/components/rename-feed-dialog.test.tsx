import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RenameDialog } from "@/components/reader/rename-feed-dialog";
import { usePreferencesStore } from "@/stores/preferences-store";
import { sampleFeeds, setupTauriMocks, teardownTauriMocks } from "../../../tests/helpers/tauri-mocks";

vi.mock("@/components/reader/rename-feed-dialog-view", () => ({
  RenameFeedDialogView: (props: {
    folderSelectProps?: {
      canCreateFolder: boolean;
      isCreatingFolder: boolean;
      newFolderName: string;
      onValueChange: (value: string) => void;
      onNewFolderNameChange: (value: string) => void;
    };
    onOpenChange: (open: boolean) => void;
    onSubmit: () => void;
  }) => (
    <div>
      <div data-testid="folder-create-enabled">{String(props.folderSelectProps?.canCreateFolder)}</div>
      <button type="button" onClick={() => props.folderSelectProps?.onValueChange("__new__")}>
        New folder
      </button>
      {props.folderSelectProps?.isCreatingFolder && (
        <input
          aria-label="Folder name"
          value={props.folderSelectProps.newFolderName}
          onChange={(event) => props.folderSelectProps?.onNewFolderNameChange(event.target.value)}
        />
      )}
      <button type="button" onClick={props.onSubmit}>
        Save
      </button>
      <button type="button" onClick={() => props.onOpenChange(false)}>
        Cancel
      </button>
    </div>
  ),
}));

const sampleFolders = [
  { id: "folder-1", account_id: "acc-1", name: "Work", sort_order: 0 },
  { id: "folder-2", account_id: "acc-1", name: "Personal", sort_order: 1 },
];

describe("RenameDialog", () => {
  beforeEach(() => {
    usePreferencesStore.setState({ prefs: {}, loaded: true });
  });

  afterEach(() => {
    teardownTauriMocks();
    usePreferencesStore.setState({ prefs: {}, loaded: false });
  });

  it("creates a new folder only when saving the edited feed", async () => {
    const user = userEvent.setup();
    const calls: Array<{ cmd: string; args: Record<string, unknown> }> = [];
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");
    const onOpenChange = vi.fn();

    setupTauriMocks((cmd, args) => {
      calls.push({ cmd, args });

      switch (cmd) {
        case "list_folders":
          return sampleFolders.filter((folder) => folder.account_id === args.accountId);
        case "create_folder":
          return { id: "folder-new", account_id: "acc-1", name: args.name, sort_order: 2 };
        case "update_feed_folder":
          return null;
        case "rename_feed":
        case "update_feed_display_mode":
          return null;
        default:
          return undefined;
      }
    });

    render(
      <QueryClientProvider client={queryClient}>
        <RenameDialog feed={sampleFeeds[0]} open={true} onOpenChange={onOpenChange} />
      </QueryClientProvider>,
    );

    expect(screen.getByTestId("folder-create-enabled")).toHaveTextContent("true");

    await user.click(screen.getByRole("button", { name: "New folder" }));
    await user.type(screen.getByLabelText("Folder name"), "Reading");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    expect(calls).toContainEqual({ cmd: "create_folder", args: { accountId: "acc-1", name: "Reading" } });
    expect(calls).toContainEqual({
      cmd: "update_feed_folder",
      args: { feedId: "feed-1", folderId: "folder-new" },
    });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["feeds"] });
  });

  it("does not create a folder when the dialog closes without saving", async () => {
    const user = userEvent.setup();
    const calls: Array<{ cmd: string; args: Record<string, unknown> }> = [];

    setupTauriMocks((cmd, args) => {
      calls.push({ cmd, args });

      switch (cmd) {
        case "list_folders":
          return sampleFolders.filter((folder) => folder.account_id === args.accountId);
        default:
          return undefined;
      }
    });

    render(
      <QueryClientProvider
        client={
          new QueryClient({
            defaultOptions: {
              queries: { retry: false },
            },
          })
        }
      >
        <RenameDialog feed={sampleFeeds[0]} open={true} onOpenChange={vi.fn()} />
      </QueryClientProvider>,
    );

    await user.click(screen.getByRole("button", { name: "New folder" }));
    await user.type(screen.getByLabelText("Folder name"), "Reading");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(calls.find((call) => call.cmd === "create_folder")).toBeUndefined();
    expect(calls.find((call) => call.cmd === "update_feed_folder")).toBeUndefined();
  });
});
