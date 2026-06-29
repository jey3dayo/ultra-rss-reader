import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expectTauriCommandError, suppressConsoleError } from "@tests/helpers/console-spies";
import { createQueryWrapper } from "@tests/helpers/create-wrapper";
import { sampleFeeds } from "@tests/helpers/fixtures";
import { setupTauriMocks, teardownTauriMocks } from "@tests/helpers/tauri-mocks";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FeedEditDialog } from "@/components/reader/feed-edit-dialog";
import { queryKeys } from "@/lib/query/query-invalidation";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";

vi.mock("@/components/reader/feed-edit-dialog-view", () => ({
  FeedEditDialogView: (props: {
    title: string;
    onTitleChange: (value: string) => void;
    onDisplayModeChange: (value: string) => void;
    urlFields: Array<{
      label: string;
      value: string;
      copyLabel: string;
      onCopy: () => void;
    }>;
    folderSelectProps?: {
      canCreateFolder: boolean;
      isCreatingFolder: boolean;
      newFolderName: string;
      onValueChange: (value: string) => void;
      onNewFolderNameChange: (value: string) => void;
    };
    labels: {
      titleField: string;
      save: string;
      cancel: string;
    };
    onOpenChange: (open: boolean) => void;
    onSubmit: () => void;
    open: boolean;
  }) => {
    if (!props.open) return null;

    return (
      <div>
        <label>
          {props.labels.titleField}
          <input
            aria-label={props.labels.titleField}
            value={props.title}
            onChange={(event) => props.onTitleChange(event.target.value)}
          />
        </label>
        <button type="button" onClick={() => props.onDisplayModeChange("preview")}>
          Set preview
        </button>
        <button type="button" onClick={() => props.onDisplayModeChange("custom")}>
          Set custom mode
        </button>
        {props.urlFields.map((field) => (
          <button key={field.label} type="button" onClick={field.onCopy}>
            {field.copyLabel}
          </button>
        ))}
        <div data-testid="folder-create-enabled">{String(props.folderSelectProps?.canCreateFolder)}</div>
        <button type="button" onClick={() => props.folderSelectProps?.onValueChange("folder-2")}>
          Move to folder 2
        </button>
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
          {props.labels.save}
        </button>
        <button type="button" onClick={() => props.onOpenChange(false)}>
          {props.labels.cancel}
        </button>
      </div>
    );
  },
}));

const sampleFolders = [
  { id: "folder-1", account_id: "acc-1", name: "Work", sort_order: 0 },
  { id: "folder-2", account_id: "acc-1", name: "Personal", sort_order: 1 },
];

describe("FeedEditDialog", () => {
  beforeEach(() => {
    usePreferencesStore.setState({ prefs: {}, loaded: true });
    useUiStore.setState({ ...useUiStore.getInitialState() });
  });

  afterEach(() => {
    teardownTauriMocks();
    vi.restoreAllMocks();
    usePreferencesStore.setState({ prefs: {}, loaded: false });
    useUiStore.setState({ ...useUiStore.getInitialState() });
  });

  it("creates a new folder only when saving the edited feed", async () => {
    const user = userEvent.setup();
    const calls: Array<{ cmd: string; args: Record<string, unknown> }> = [];
    const { queryClient, wrapper } = createQueryWrapper();
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
        case "update_feed_display_settings":
          return null;
        default:
          return undefined;
      }
    });

    render(<FeedEditDialog feed={sampleFeeds[0]} open={true} onOpenChange={onOpenChange} />, { wrapper });

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
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.feeds.root });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.folders.root });
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

    render(<FeedEditDialog feed={sampleFeeds[0]} open={true} onOpenChange={vi.fn()} />, {
      wrapper: createQueryWrapper().wrapper,
    });

    await user.click(screen.getByRole("button", { name: "New folder" }));
    await user.type(screen.getByLabelText("Folder name"), "Reading");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(calls.find((call) => call.cmd === "create_folder")).toBeUndefined();
    expect(calls.find((call) => call.cmd === "update_feed_folder")).toBeUndefined();
  });

  it("continues renaming and display-mode updates when folder update fails", async () => {
    const user = userEvent.setup();
    const consoleError = suppressConsoleError();
    const calls: Array<{ cmd: string; args: Record<string, unknown> }> = [];
    const { queryClient, wrapper } = createQueryWrapper();
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");
    const onOpenChange = vi.fn();
    const feed = { ...sampleFeeds[0], folder_id: "folder-1" };

    setupTauriMocks((cmd, args) => {
      calls.push({ cmd, args });

      switch (cmd) {
        case "list_folders":
          return sampleFolders.filter((folder) => folder.account_id === args.accountId);
        case "update_feed_folder":
          throw { type: "UserVisible", message: "folder update failed" };
        case "rename_feed":
        case "update_feed_display_settings":
          return null;
        default:
          return undefined;
      }
    });

    render(<FeedEditDialog feed={feed} open={true} onOpenChange={onOpenChange} />, { wrapper });

    await user.clear(screen.getByLabelText("Title"));
    await user.type(screen.getByLabelText("Title"), "Renamed Feed");
    await user.click(screen.getByRole("button", { name: "Move to folder 2" }));
    await user.click(screen.getByRole("button", { name: "Set preview" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(calls).toContainEqual({
        cmd: "rename_feed",
        args: { feedId: "feed-1", title: "Renamed Feed" },
      });
      expect(calls).toContainEqual({
        cmd: "update_feed_display_settings",
        args: { feedId: "feed-1", readerMode: "on", webPreviewMode: "on" },
      });
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.feeds.root });
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.folders.root });
      expect(onOpenChange).not.toHaveBeenCalled();
    });

    expectTauriCommandError(consoleError, "update_feed_folder", {
      type: "UserVisible",
      message: "folder update failed",
    });
  });

  it("keeps the dialog open when the display-mode update fails", async () => {
    const user = userEvent.setup();
    const consoleError = suppressConsoleError();
    const calls: Array<{ cmd: string; args: Record<string, unknown> }> = [];
    const { wrapper } = createQueryWrapper();
    const onOpenChange = vi.fn();

    setupTauriMocks((cmd, args) => {
      calls.push({ cmd, args });

      switch (cmd) {
        case "list_folders":
          return sampleFolders.filter((folder) => folder.account_id === args.accountId);
        case "update_feed_display_settings":
          throw { type: "UserVisible", message: "display update failed" };
        default:
          return undefined;
      }
    });

    render(<FeedEditDialog feed={sampleFeeds[0]} open={true} onOpenChange={onOpenChange} />, { wrapper });

    await user.click(screen.getByRole("button", { name: "Set preview" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(calls).toContainEqual({
        cmd: "update_feed_display_settings",
        args: { feedId: "feed-1", readerMode: "on", webPreviewMode: "on" },
      });
    });

    expect(onOpenChange).not.toHaveBeenCalled();
    expectTauriCommandError(consoleError, "update_feed_display_settings", {
      type: "UserVisible",
      message: "display update failed",
    });
  });

  it("keeps the dialog open and surfaces validation when submitting an empty title", async () => {
    const user = userEvent.setup();
    const calls: Array<{ cmd: string; args: Record<string, unknown> }> = [];
    const onOpenChange = vi.fn();

    setupTauriMocks((cmd, args) => {
      calls.push({ cmd, args });

      switch (cmd) {
        case "list_folders":
          return sampleFolders.filter((folder) => folder.account_id === args.accountId);
        default:
          return undefined;
      }
    });

    render(<FeedEditDialog feed={sampleFeeds[0]} open={true} onOpenChange={onOpenChange} />, {
      wrapper: createQueryWrapper().wrapper,
    });

    await user.clear(screen.getByLabelText(/title/i));
    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(useUiStore.getState().toastMessage?.message).toBe("Title is required");
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(calls.find((call) => call.cmd === "rename_feed")).toBeUndefined();
  });

  it("trims the feed title before validating and renaming", async () => {
    const user = userEvent.setup();
    const calls: Array<{ cmd: string; args: Record<string, unknown> }> = [];
    const onOpenChange = vi.fn();

    setupTauriMocks((cmd, args) => {
      calls.push({ cmd, args });

      switch (cmd) {
        case "list_folders":
          return sampleFolders.filter((folder) => folder.account_id === args.accountId);
        case "rename_feed":
          return null;
        default:
          return undefined;
      }
    });

    render(<FeedEditDialog feed={sampleFeeds[0]} open={true} onOpenChange={onOpenChange} />, {
      wrapper: createQueryWrapper().wrapper,
    });

    await user.clear(screen.getByLabelText(/title/i));
    await user.type(screen.getByLabelText(/title/i), "  Renamed Feed  ");
    await user.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(calls).toContainEqual({
        cmd: "rename_feed",
        args: { feedId: "feed-1", title: "Renamed Feed" },
      });
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it("ignores unknown display-mode values from the view", async () => {
    const user = userEvent.setup();
    const calls: Array<{ cmd: string; args: Record<string, unknown> }> = [];
    const onOpenChange = vi.fn();

    setupTauriMocks((cmd, args) => {
      calls.push({ cmd, args });

      switch (cmd) {
        case "list_folders":
          return sampleFolders.filter((folder) => folder.account_id === args.accountId);
        default:
          return undefined;
      }
    });

    render(<FeedEditDialog feed={sampleFeeds[0]} open={true} onOpenChange={onOpenChange} />, {
      wrapper: createQueryWrapper().wrapper,
    });

    await user.click(screen.getByRole("button", { name: "Set custom mode" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
    expect(calls.find((call) => call.cmd === "update_feed_display_settings")).toBeUndefined();
  });

  it("keeps the dialog open when renaming fails", async () => {
    const user = userEvent.setup();
    const consoleError = suppressConsoleError();
    const calls: Array<{ cmd: string; args: Record<string, unknown> }> = [];
    const { wrapper } = createQueryWrapper();
    const onOpenChange = vi.fn();

    setupTauriMocks((cmd, args) => {
      calls.push({ cmd, args });

      switch (cmd) {
        case "list_folders":
          return sampleFolders.filter((folder) => folder.account_id === args.accountId);
        case "rename_feed":
          throw { type: "UserVisible", message: "rename failed" };
        default:
          return undefined;
      }
    });

    render(<FeedEditDialog feed={sampleFeeds[0]} open={true} onOpenChange={onOpenChange} />, { wrapper });

    await user.clear(screen.getByLabelText("Title"));
    await user.type(screen.getByLabelText("Title"), "Renamed Feed");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(calls).toContainEqual({
        cmd: "rename_feed",
        args: { feedId: "feed-1", title: "Renamed Feed" },
      });
    });

    expect(onOpenChange).not.toHaveBeenCalled();
    expectTauriCommandError(consoleError, "rename_feed", {
      type: "UserVisible",
      message: "rename failed",
    });
  });

  it("copies website and feed URLs from the edit dialog", async () => {
    const user = userEvent.setup();
    const calls: Array<{ cmd: string; args: Record<string, unknown> }> = [];

    setupTauriMocks((cmd, args) => {
      calls.push({ cmd, args });

      switch (cmd) {
        case "list_folders":
          return sampleFolders.filter((folder) => folder.account_id === args.accountId);
        case "copy_to_clipboard":
          return null;
        default:
          return undefined;
      }
    });

    render(<FeedEditDialog feed={sampleFeeds[0]} open={true} onOpenChange={vi.fn()} />, {
      wrapper: createQueryWrapper().wrapper,
    });

    await user.click(screen.getByRole("button", { name: "Copy Website URL" }));
    await user.click(screen.getByRole("button", { name: "Copy Feed URL" }));

    expect(calls).toContainEqual({
      cmd: "copy_to_clipboard",
      args: { text: "https://example.com" },
    });
    expect(calls).toContainEqual({
      cmd: "copy_to_clipboard",
      args: { text: "https://example.com/feed.xml" },
    });
  });
});
