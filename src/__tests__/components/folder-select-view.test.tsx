import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FolderSelectView } from "@/components/reader/folder-select-view";

describe("FolderSelectView", () => {
  it("renders normalized options and reports folder selection", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();

    render(
      <FolderSelectView
        labelId="folder-label"
        label="Folder"
        value="folder-1"
        options={[
          { value: "", label: "No folder" },
          { value: "folder-1", label: "Work" },
        ]}
        canCreateFolder={true}
        disabled={false}
        isCreatingFolder={false}
        newFolderOptionLabel="New folder"
        newFolderLabel="Folder name"
        newFolderName=""
        newFolderPlaceholder="Enter folder name"
        onValueChange={onValueChange}
        onNewFolderNameChange={vi.fn()}
      />,
    );

    const folderSelect = screen.getByRole("combobox", { name: "Folder" });
    expect(folderSelect).toHaveTextContent("Work");

    await user.click(folderSelect);
    await user.click(await screen.findByRole("option", { name: "New folder" }));

    expect(onValueChange).toHaveBeenCalledWith("__new__");
  });

  it("renders the new folder input when creating a folder", async () => {
    const onNewFolderNameChange = vi.fn();

    render(
      <FolderSelectView
        labelId="folder-label"
        label="Folder"
        value="__new__"
        options={[
          { value: "", label: "No folder" },
          { value: "folder-1", label: "Work" },
        ]}
        canCreateFolder={true}
        disabled={false}
        isCreatingFolder={true}
        newFolderOptionLabel="New folder"
        newFolderLabel="Folder name"
        newFolderName=""
        newFolderPlaceholder="Enter folder name"
        onValueChange={vi.fn()}
        onNewFolderNameChange={onNewFolderNameChange}
      />,
    );

    fireEvent.change(screen.getByLabelText("Folder name"), { target: { value: "Reading" } });

    expect(onNewFolderNameChange).toHaveBeenLastCalledWith("Reading");
  });

  it("omits the new folder option when folder creation is disabled", async () => {
    const user = userEvent.setup();

    render(
      <FolderSelectView
        labelId="folder-label"
        label="Folder"
        value=""
        options={[
          { value: "", label: "No folder" },
          { value: "folder-1", label: "Work" },
        ]}
        canCreateFolder={false}
        disabled={false}
        isCreatingFolder={false}
        newFolderOptionLabel="New folder"
        newFolderLabel="Folder name"
        newFolderName=""
        newFolderPlaceholder="Enter folder name"
        onValueChange={vi.fn()}
        onNewFolderNameChange={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("combobox", { name: "Folder" }));

    expect(screen.queryByRole("option", { name: "New folder" })).not.toBeInTheDocument();
  });
});
