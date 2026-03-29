import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { AddFeedDialogView } from "@/components/reader/add-feed-dialog-view";

describe("AddFeedDialogView", () => {
  it("renders the dialog layout and delegates display interactions", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onUrlChange = vi.fn();
    const onDiscover = vi.fn();
    const onSelectedFeedUrlChange = vi.fn();
    const onFolderValueChange = vi.fn();
    const onNewFolderNameChange = vi.fn();
    const onSubmit = vi.fn();
    const urlInputRef = createRef<HTMLInputElement>();
    const newFolderInputRef = createRef<HTMLInputElement>();

    render(
      <AddFeedDialogView
        open={true}
        onOpenChange={onOpenChange}
        url="https://example.com"
        onUrlChange={onUrlChange}
        onDiscover={onDiscover}
        discovering={false}
        loading={false}
        discoveredFeedsFoundLabel="Found 2 feeds"
        discoveredFeedOptions={[
          { value: "https://example.com/feed.xml", label: "Tech Blog" },
          { value: "https://example.com/atom.xml", label: "News Feed" },
        ]}
        selectedFeedUrl="https://example.com/feed.xml"
        onSelectedFeedUrlChange={onSelectedFeedUrlChange}
        folderSelectProps={{
          labelId: "folder-label",
          label: "Folder",
          value: "__new__",
          options: [
            { value: "", label: "No folder" },
            { value: "folder-1", label: "Work" },
            { value: "__new__", label: "New folder" },
          ],
          disabled: false,
          isCreatingFolder: true,
          newFolderLabel: "Folder name",
          newFolderName: "Reading",
          newFolderPlaceholder: "Enter folder name",
          onValueChange: onFolderValueChange,
          onNewFolderNameChange,
          newFolderInputRef,
        }}
        error={null}
        successMessage="Feed detected"
        isDiscoverDisabled={false}
        isSubmitDisabled={false}
        labels={{
          title: "Add Feed",
          description: "Add a feed from a URL or website",
          urlPlaceholder: "Feed or Site URL",
          discover: "Discover",
          discovering: "Discovering",
          cancel: "Cancel",
          add: "Add",
          adding: "Adding",
        }}
        inputRef={urlInputRef}
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Tech Blog" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Folder" })).toHaveTextContent("New folder");
    expect(screen.getByLabelText("Folder name")).toHaveValue("Reading");
    expect(screen.getByText("Feed detected")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Discover" }));
    await user.click(screen.getByText("News Feed"));
    await user.click(screen.getByRole("button", { name: "Add" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onDiscover).toHaveBeenCalledTimes(1);
    expect(onSelectedFeedUrlChange).toHaveBeenCalledTimes(1);
    expect(onSelectedFeedUrlChange.mock.calls[0]?.[0]).toBe("https://example.com/atom.xml");
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
