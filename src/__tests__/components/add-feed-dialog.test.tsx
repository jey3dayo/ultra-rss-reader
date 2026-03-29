import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AddFeedDialog } from "@/components/reader/add-feed-dialog";
import { usePreferencesStore } from "@/stores/preferences-store";
import { setupTauriMocks, teardownTauriMocks } from "../../../tests/helpers/tauri-mocks";

vi.mock("@/components/reader/add-feed-dialog-view", () => ({
  AddFeedDialogView: (props: {
    url: string;
    onUrlChange: (value: string) => void;
    onDiscover: () => void;
    discoveredFeedOptions: Array<{ value: string; label: string }>;
    onSelectedFeedUrlChange: (value: string) => void;
    folderSelectProps: {
      isCreatingFolder: boolean;
      newFolderName: string;
      onValueChange: (value: string) => void;
      onNewFolderNameChange: (value: string) => void;
    };
    onSubmit: () => void;
  }) => (
    <div>
      <input aria-label="Feed URL" value={props.url} onChange={(event) => props.onUrlChange(event.target.value)} />
      <button type="button" onClick={props.onDiscover}>
        Discover
      </button>
      {props.discoveredFeedOptions.map((option) => (
        <button key={option.value} type="button" onClick={() => props.onSelectedFeedUrlChange(option.value)}>
          {option.label}
        </button>
      ))}
      <button type="button" onClick={() => props.folderSelectProps.onValueChange("__new__")}>
        New folder
      </button>
      {props.folderSelectProps.isCreatingFolder && (
        <input
          aria-label="Folder name"
          value={props.folderSelectProps.newFolderName}
          onChange={(event) => props.folderSelectProps.onNewFolderNameChange(event.target.value)}
        />
      )}
      <button type="button" onClick={props.onSubmit}>
        Add
      </button>
    </div>
  ),
}));

const sampleFolders = [
  { id: "folder-1", account_id: "acc-1", name: "Work", sort_order: 0 },
  { id: "folder-2", account_id: "acc-1", name: "Personal", sort_order: 1 },
];

describe("AddFeedDialog", () => {
  beforeEach(() => {
    usePreferencesStore.setState({ prefs: {}, loaded: true });
  });

  afterEach(() => {
    teardownTauriMocks();
    usePreferencesStore.setState({ prefs: {}, loaded: false });
  });

  it("keeps async discovery and folder assignment in the container", async () => {
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
        case "discover_feeds":
          return [
            { url: "https://example.com/feed.xml", title: "Tech Blog" },
            { url: "https://example.com/atom.xml", title: "News Feed" },
          ];
        case "create_folder":
          return { id: "folder-new", account_id: "acc-1", name: args.name, sort_order: 2 };
        case "add_local_feed":
          return {
            id: "feed-new",
            account_id: "acc-1",
            folder_id: null,
            title: "Imported Feed",
            url: args.url,
            site_url: args.url,
            unread_count: 0,
            display_mode: "normal",
          };
        case "update_feed_folder":
          return null;
        default:
          return null;
      }
    });

    render(
      <QueryClientProvider client={queryClient}>
        <AddFeedDialog open={true} onOpenChange={onOpenChange} accountId="acc-1" />
      </QueryClientProvider>,
    );

    await user.type(screen.getByLabelText("Feed URL"), "https://example.com");
    await user.click(screen.getByRole("button", { name: "Discover" }));
    await user.click(await screen.findByText("News Feed"));
    await user.click(screen.getByRole("button", { name: "New folder" }));
    await user.type(screen.getByLabelText("Folder name"), "Reading");
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    expect(calls).toContainEqual({ cmd: "discover_feeds", args: { url: "https://example.com" } });
    expect(calls).toContainEqual({ cmd: "create_folder", args: { accountId: "acc-1", name: "Reading" } });
    expect(calls).toContainEqual({
      cmd: "add_local_feed",
      args: { accountId: "acc-1", url: "https://example.com/atom.xml" },
    });
    expect(calls).toContainEqual({
      cmd: "update_feed_folder",
      args: { feedId: "feed-new", folderId: "folder-new" },
    });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["feeds"] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["accountUnreadCount"] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["folders"] });
  });
});
