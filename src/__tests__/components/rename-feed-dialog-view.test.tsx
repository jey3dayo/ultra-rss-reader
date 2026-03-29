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
        displayMode="widescreen"
        displayModeOptions={[
          { value: "normal", label: "Normal" },
          { value: "widescreen", label: "Widescreen" },
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
          disabled: false,
          isCreatingFolder: false,
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
    expect(screen.getByRole("combobox", { name: "Display Mode" })).toHaveTextContent("Widescreen");
    expect(screen.getByRole("combobox", { name: "Folder" })).toHaveTextContent("Work");

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Fresh" } });
    await user.click(screen.getByRole("combobox", { name: "Display Mode" }));
    await user.click(await screen.findByText("Normal"));
    await user.click(screen.getByRole("button", { name: "Save" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onTitleChange).toHaveBeenLastCalledWith("Fresh");
    expect(onDisplayModeChange).toHaveBeenCalledWith("normal");
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("disables saving for blank titles", () => {
    render(
      <RenameFeedDialogView
        open={true}
        title="   "
        loading={false}
        displayMode="normal"
        displayModeOptions={[{ value: "normal", label: "Normal" }]}
        onOpenChange={vi.fn()}
        onTitleChange={vi.fn()}
        onDisplayModeChange={vi.fn()}
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
