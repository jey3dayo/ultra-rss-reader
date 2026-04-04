import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { RenameFeedDialogView } from "@/components/reader/rename-feed-dialog-view";

describe("RenameFeedDialogView", () => {
  it("renders form fields and delegates interactions", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onTitleChange = vi.fn();
    const onDisplayModeChange = vi.fn();
    const onCopySiteUrl = vi.fn();
    const onCopyFeedUrl = vi.fn();
    const onFolderValueChange = vi.fn();
    const onSubmit = vi.fn();
    const inputRef = createRef<HTMLInputElement>();

    render(
      <RenameFeedDialogView
        open={true}
        title="Tech Blog"
        loading={false}
        displayMode="preview"
        displayModeOptions={[
          { value: "default", label: "Default" },
          { value: "standard", label: "Standard" },
          { value: "preview", label: "Preview" },
        ]}
        onOpenChange={onOpenChange}
        onTitleChange={onTitleChange}
        onDisplayModeChange={onDisplayModeChange}
        urlFields={[
          {
            key: "site-url",
            label: "Website URL",
            value: "https://example.com",
            copyLabel: "Copy Website URL",
            onCopy: onCopySiteUrl,
          },
          {
            key: "feed-url",
            label: "Feed URL",
            value: "https://example.com/feed.xml",
            copyLabel: "Copy Feed URL",
            onCopy: onCopyFeedUrl,
          },
        ]}
        folderSelectProps={{
          labelId: "folder-label",
          label: "Folder",
          value: "folder-1",
          options: [
            { value: "", label: "No folder" },
            { value: "folder-1", label: "Work" },
          ],
          canCreateFolder: true,
          disabled: false,
          isCreatingFolder: false,
          newFolderOptionLabel: "New folder",
          newFolderLabel: "Folder name",
          newFolderName: "",
          newFolderPlaceholder: "Enter folder name",
          onValueChange: onFolderValueChange,
          onNewFolderNameChange: vi.fn(),
        }}
        labels={{
          title: "Edit Feed",
          titleField: "Title",
          displayMode: "Display Mode",
          cancel: "Cancel",
          save: "Save",
          saving: "Saving",
        }}
        inputRef={inputRef}
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText("Title")).toHaveValue("Tech Blog");
    expect(screen.getByLabelText("Website URL")).toHaveValue("https://example.com");
    expect(screen.getByLabelText("Feed URL")).toHaveValue("https://example.com/feed.xml");
    expect(screen.getByRole("button", { name: "Copy Website URL" })).toHaveClass(
      "active:not-aria-[haspopup]:-translate-y-1/2",
    );
    expect(screen.getByRole("button", { name: "Copy Feed URL" })).toHaveClass(
      "active:not-aria-[haspopup]:-translate-y-1/2",
    );
    expect(screen.getByRole("combobox", { name: "Display Mode" })).toHaveTextContent("Preview");
    expect(screen.getByRole("combobox", { name: "Folder" })).toHaveTextContent("Work");

    const titleInput = screen.getByLabelText("Title");
    titleInput.focus();

    fireEvent.change(titleInput, { target: { value: "Fresh" } });
    await user.click(screen.getByRole("button", { name: "Copy Website URL" }));
    await user.click(screen.getByRole("button", { name: "Copy Feed URL" }));
    expect(titleInput).toHaveFocus();
    await user.click(screen.getByRole("combobox", { name: "Display Mode" }));
    await user.click(await screen.findByText("Standard"));
    await user.click(screen.getByRole("button", { name: "Save" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onTitleChange).toHaveBeenLastCalledWith("Fresh");
    expect(onCopySiteUrl).toHaveBeenCalledTimes(1);
    expect(onCopyFeedUrl).toHaveBeenCalledTimes(1);
    expect(onDisplayModeChange).toHaveBeenCalledWith("standard");
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("disables saving for blank titles", () => {
    render(
      <RenameFeedDialogView
        open={true}
        title="   "
        loading={false}
        displayMode="standard"
        displayModeOptions={[{ value: "standard", label: "Standard" }]}
        onOpenChange={vi.fn()}
        onTitleChange={vi.fn()}
        onDisplayModeChange={vi.fn()}
        urlFields={[]}
        folderSelectProps={{
          labelId: "folder-label",
          label: "Folder",
          value: "",
          options: [{ value: "", label: "No folder" }],
          canCreateFolder: true,
          disabled: false,
          isCreatingFolder: false,
          newFolderOptionLabel: "New folder",
          newFolderLabel: "Folder name",
          newFolderName: "",
          newFolderPlaceholder: "Enter folder name",
          onValueChange: vi.fn(),
          onNewFolderNameChange: vi.fn(),
        }}
        labels={{
          title: "Edit Feed",
          titleField: "Title",
          displayMode: "Display Mode",
          cancel: "Cancel",
          save: "Save",
          saving: "Saving",
        }}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });
});
