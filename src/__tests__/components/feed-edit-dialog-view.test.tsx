import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { FeedEditDialogView } from "@/components/reader/feed-edit-dialog-view";

describe("FeedEditDialogView", () => {
  it("renders form fields and delegates interactions", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onTitleChange = vi.fn();
    const onDisplayModeChange = vi.fn();
    const onCopySiteUrl = vi.fn();
    const onCopyFeedUrl = vi.fn();
    const onFolderValueChange = vi.fn();
    const onSubmit = vi.fn();
    const onRequestUnsubscribe = vi.fn();
    const inputRef = createRef<HTMLInputElement>();

    render(
      <FeedEditDialogView
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
          unsubscribe: "Unsubscribe",
          unsubscribeAction: "Unsubscribe…",
          feedInformation: "Feed information",
          unsubscribeDescription: "Articles from this feed will also be deleted.",
        }}
        inputRef={inputRef}
        onRequestUnsubscribe={onRequestUnsubscribe}
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText("Title")).toHaveValue("Tech Blog");
    expect(screen.getByLabelText("Title").closest("form")).toBeInTheDocument();
    expect(screen.getByTestId("feed-information")).toHaveAttribute("open");
    expect(screen.getByTestId("feed-information").querySelector("summary")).toHaveTextContent("Feed information");
    expect(screen.getByText("https://example.com")).not.toHaveAttribute("title");
    expect(screen.getByText("https://example.com/feed.xml")).not.toHaveAttribute("title");
    expect(screen.getByRole("combobox", { name: "Display Mode" })).toHaveTextContent("Preview");
    expect(screen.getByRole("combobox", { name: "Folder" })).toHaveTextContent("Work");
    const titleRow = screen.getByLabelText("Title").closest(".grid");
    const displayModeRow = screen.getByRole("combobox", { name: "Display Mode" }).closest(".grid");
    const folderRow = screen.getByRole("combobox", { name: "Folder" }).closest(".grid");
    expect(titleRow?.lastElementChild).toHaveClass("lg:pr-2");
    expect(displayModeRow?.lastElementChild).toHaveClass("lg:pr-2");
    expect(folderRow?.lastElementChild).toHaveClass("lg:pr-2");
    expect(folderRow).toHaveClass("[&>div]:sm:flex", "[&>div]:sm:justify-end");
    expect(screen.getByRole("combobox", { name: "Folder" })).not.toHaveClass("sm:mr-2", "lg:mr-2");
    expect(screen.getByText("Unsubscribe")).toBeInTheDocument();
    const unsubscribeDescription = screen.getByText("Articles from this feed will also be deleted.");
    expect(screen.getByRole("button", { name: "Unsubscribe…" })).toHaveAttribute(
      "aria-describedby",
      unsubscribeDescription.id,
    );

    const titleInput = screen.getByLabelText("Title");
    titleInput.focus();

    fireEvent.change(titleInput, { target: { value: "Fresh" } });
    fireEvent.click(screen.getByRole("button", { name: "Copy Website URL" }));
    fireEvent.click(screen.getByRole("button", { name: "Copy Feed URL" }));
    expect(titleInput).toHaveFocus();
    await user.click(screen.getByRole("combobox", { name: "Display Mode" }));
    await user.click(await screen.findByText("Standard", {}, { timeout: 10_000 }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "Unsubscribe…" }));

    expect(onTitleChange).toHaveBeenLastCalledWith("Fresh");
    expect(onCopySiteUrl).toHaveBeenCalledTimes(1);
    expect(onCopyFeedUrl).toHaveBeenCalledTimes(1);
    expect(onDisplayModeChange).toHaveBeenCalledWith("standard");
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onRequestUnsubscribe).toHaveBeenCalledTimes(1);
  });

  it("disables saving for blank titles", () => {
    render(
      <FeedEditDialogView
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
          unsubscribe: "Unsubscribe",
          unsubscribeAction: "Unsubscribe…",
          feedInformation: "Feed information",
          unsubscribeDescription: "Articles from this feed will also be deleted.",
        }}
        onRequestUnsubscribe={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });
});
