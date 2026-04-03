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
    const onFolderValueChange = vi.fn();
    const onSubmit = vi.fn();
    const inputRef = createRef<HTMLInputElement>();

    render(
      <RenameFeedDialogView
        open={true}
        title="Tech Blog"
        loading={false}
        displayMode="reader_and_preview"
        displayModeOptions={[
          { value: "default", label: "Default" },
          { value: "reader_only", label: "Reader only" },
          { value: "reader_and_preview", label: "Reader + Preview" },
        ]}
        onOpenChange={onOpenChange}
        onTitleChange={onTitleChange}
        onDisplayModeChange={onDisplayModeChange}
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
    expect(screen.getByRole("combobox", { name: "Display Mode" })).toHaveTextContent("Reader + Preview");
    expect(screen.getByRole("combobox", { name: "Folder" })).toHaveTextContent("Work");

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Fresh" } });
    await user.click(screen.getByRole("combobox", { name: "Display Mode" }));
    await user.click(await screen.findByText("Reader only"));
    await user.click(screen.getByRole("button", { name: "Save" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onTitleChange).toHaveBeenLastCalledWith("Fresh");
    expect(onDisplayModeChange).toHaveBeenCalledWith("reader_only");
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("disables saving for blank titles", () => {
    render(
      <RenameFeedDialogView
        open={true}
        title="   "
        loading={false}
        displayMode="reader_only"
        displayModeOptions={[{ value: "reader_only", label: "Reader only" }]}
        onOpenChange={vi.fn()}
        onTitleChange={vi.fn()}
        onDisplayModeChange={vi.fn()}
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
