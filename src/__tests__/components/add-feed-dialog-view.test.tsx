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
          ],
          canCreateFolder: true,
          disabled: false,
          isCreatingFolder: true,
          newFolderOptionLabel: "New folder",
          newFolderLabel: "Folder name",
          newFolderName: "Reading",
          newFolderPlaceholder: "Enter folder name",
          onValueChange: onFolderValueChange,
          onNewFolderNameChange,
          newFolderInputRef,
        }}
        error={null}
        successMessage="Feed detected"
        urlHint="Paste a feed or site URL."
        urlHintTone="muted"
        isDiscoverDisabled={false}
        isSubmitDisabled={false}
        labels={{
          title: "Add Feed",
          description: "Add a feed from a URL or website",
          urlLabel: "Feed",
          urlPlaceholder: "https://example.com/feed.xml",
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
    expect(screen.getByRole("dialog")).toHaveClass("rounded-xl");
    expect(screen.getByRole("dialog")).toHaveClass(
      "flex",
      "max-h-[calc(100dvh-2rem)]",
      "flex-col",
      "bg-surface-2",
      "shadow-elevation-3",
    );
    expect(screen.getByText("Add a feed from a URL or website")).toHaveClass("text-foreground-soft");
    expect(screen.getByLabelText("Feed")).toHaveValue("https://example.com");
    expect(screen.getByTestId("feed-dialog-form-panel")).toHaveClass(
      "motion-content-swap",
      "motion-contextual-surface",
    );
    expect(screen.getByTestId("feed-dialog-form-panel")).not.toHaveClass(
      "rounded-md",
      "border",
      "bg-surface-1/72",
      "shadow-elevation-1",
    );
    const urlRow = screen.getByTestId("feed-dialog-url-section").closest(".grid");
    const folderRow = screen.getByText("Folder").closest(".grid");

    expect(urlRow).toHaveClass("sm:grid-cols-[minmax(8.5rem,12rem)_minmax(0,1fr)]", "border-b-0");
    expect(urlRow?.lastElementChild).toHaveClass("lg:pr-2");
    expect(folderRow?.lastElementChild).toHaveClass("lg:pr-2");
    expect(screen.getByTestId("feed-dialog-url-section").querySelector(".grid")).toHaveClass("sm:w-[20rem]");
    expect(screen.getByText("Feed")).toHaveClass("whitespace-nowrap", "text-[color:var(--form-row-label)]");
    expect(screen.queryByText("Paste a feed or site URL.")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Feed")).toHaveClass("min-h-11", "bg-surface-1/78", "shadow-none");
    expect(screen.getByRole("button", { name: "Discover" })).toHaveClass(
      "min-h-11",
      "shrink-0",
      "px-3",
      "text-sm",
      "bg-surface-1/78",
      "shadow-none",
    );
    expect(screen.getByText("Found 2 feeds").parentElement).toHaveClass("motion-content-swap");
    expect(screen.getByTestId("feed-dialog-folder-section")).toHaveClass("motion-content-swap");
    expect(screen.getByTestId("feed-dialog-folder-section")).not.toHaveClass("border-t", "border-border/70");
    expect(screen.getByTestId("feed-dialog-folder-section")).toHaveAttribute("data-motion-phase", "entering");
    expect(screen.getByRole("radio", { name: "Tech Blog" })).toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: "Found 2 feeds" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Tech Blog" }).closest("label")).toHaveClass("min-h-11");
    expect(screen.getByRole("combobox", { name: "Folder" })).toHaveTextContent("New folder");
    expect(screen.getByRole("combobox", { name: "Folder" })).toHaveClass("sm:w-[20rem]");
    expect(screen.getByRole("combobox", { name: "Folder" })).not.toHaveClass("sm:mr-2", "lg:mr-2");
    expect(screen.getByLabelText("Folder name")).toHaveValue("Reading");
    expect(screen.getByText("Feed detected").closest('[data-surface-card="info"]')).toHaveClass(
      "motion-content-swap",
      "border-state-success-border",
      "bg-state-success-surface",
      "text-state-success-foreground",
    );
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
    expect(screen.getByRole("status")).toHaveAttribute("aria-atomic", "true");
    expect(screen.getByRole("status")).toHaveTextContent("Feed detected");
    expect(screen.getByRole("button", { name: "Add" })).toHaveClass("min-h-11");
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveClass("min-h-11");
    expect(screen.getByRole("button", { name: "Add" }).closest('[data-slot="dialog-footer"]')).toHaveClass(
      "mx-0",
      "mb-0",
      "shrink-0",
    );

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

  it("does not submit the form when submission is disabled", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <AddFeedDialogView
        open={true}
        onOpenChange={vi.fn()}
        url="example.com"
        onUrlChange={vi.fn()}
        onDiscover={vi.fn()}
        discovering={false}
        loading={false}
        discoveredFeedsFoundLabel={null}
        discoveredFeedOptions={[]}
        selectedFeedUrl=""
        onSelectedFeedUrlChange={vi.fn()}
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
        error="Invalid URL"
        successMessage={null}
        urlHint="Use a full URL like https://example.com"
        urlHintTone="error"
        isDiscoverDisabled={true}
        isSubmitDisabled={true}
        labels={{
          title: "Add Feed",
          description: "Add a feed from a URL or website",
          urlLabel: "Feed",
          urlPlaceholder: "https://example.com/feed.xml",
          discover: "Discover",
          discovering: "Discovering",
          cancel: "Cancel",
          add: "Add",
          adding: "Adding",
        }}
        onSubmit={onSubmit}
      />,
    );

    await user.type(screen.getByLabelText("Feed"), "{Enter}");

    const urlInput = screen.getByLabelText("Feed");
    const helperText = screen.getByText("Use a full URL like https://example.com");

    expect(helperText.id).not.toBe("");
    expect(screen.getByRole("dialog")).toHaveClass("rounded-xl");
    expect(screen.getByRole("dialog")).toHaveClass("bg-surface-2", "shadow-elevation-3");
    expect(screen.getByTestId("feed-dialog-url-section").closest(".grid")).toHaveClass(
      "sm:grid-cols-[minmax(8.5rem,12rem)_minmax(0,1fr)]",
      "border-b-0",
    );
    expect(helperText).toHaveClass("motion-content-swap", "rounded-md");
    expect(helperText).toHaveAttribute("data-motion-phase", "entering");
    expect(helperText).toHaveClass(
      "border-state-danger-border",
      "bg-state-danger-surface",
      "text-state-danger-foreground",
    );
    expect(screen.getByText("Invalid URL").closest('[data-surface-card="info"]')).toHaveClass(
      "motion-content-swap",
      "border-state-danger-border",
      "bg-state-danger-surface",
    );
    expect(screen.getByRole("status")).toHaveTextContent("Invalid URL");
    expect(urlInput).toHaveAttribute("aria-describedby", helperText.id);
    expect(urlInput).toHaveAttribute("aria-errormessage", helperText.id);
    expect(urlInput).toHaveAttribute("aria-invalid", "true");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("associates discovered feed descriptions and folder select labels with their controls", () => {
    render(
      <AddFeedDialogView
        open={true}
        onOpenChange={vi.fn()}
        url="https://example.com"
        onUrlChange={vi.fn()}
        onDiscover={vi.fn()}
        discovering={false}
        loading={false}
        discoveredFeedsFoundLabel="Found 2 feeds"
        discoveredFeedOptions={[
          {
            value: "https://example.com/feed.xml",
            label: "Tech Blog",
            description: "https://example.com/feed.xml",
          },
          {
            value: "https://example.com/atom.xml",
            label: "News Feed",
            description: "https://example.com/atom.xml",
          },
        ]}
        selectedFeedUrl="https://example.com/feed.xml"
        onSelectedFeedUrlChange={vi.fn()}
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
          onValueChange: vi.fn(),
          onNewFolderNameChange: vi.fn(),
        }}
        error={null}
        successMessage={null}
        urlHint="Paste a feed or site URL."
        urlHintTone="muted"
        isDiscoverDisabled={false}
        isSubmitDisabled={false}
        labels={{
          title: "Add Feed",
          description: "Add a feed from a URL or website",
          urlLabel: "Feed",
          urlPlaceholder: "https://example.com/feed.xml",
          discover: "Discover",
          discovering: "Discovering",
          cancel: "Cancel",
          add: "Add",
          adding: "Adding",
        }}
        onSubmit={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("radio", {
        name: "Tech Blog https://example.com/feed.xml",
      }),
    ).toBeChecked();
    expect(screen.getByRole("radiogroup", { name: "Found 2 feeds" })).toContainElement(
      screen.getByRole("radio", {
        name: "Tech Blog https://example.com/feed.xml",
      }),
    );
    expect(
      screen.getByRole("radio", {
        name: "News Feed https://example.com/atom.xml",
      }),
    ).not.toBeChecked();

    const folderLabel = screen.getByText("Folder");
    const folderSelect = screen.getByRole("combobox", { name: "Folder" });
    const folderLabelContainer = folderLabel.closest("[id]");

    expect(folderLabelContainer).toHaveAttribute("id", "folder-label");
    expect(folderSelect).toHaveAttribute("aria-labelledby", "folder-label");
  });

  it("keeps URL label, description, and error associations on the same input control", () => {
    render(
      <AddFeedDialogView
        open={true}
        onOpenChange={vi.fn()}
        url="not-a-url"
        onUrlChange={vi.fn()}
        onDiscover={vi.fn()}
        discovering={false}
        loading={false}
        discoveredFeedsFoundLabel={null}
        discoveredFeedOptions={[]}
        selectedFeedUrl=""
        onSelectedFeedUrlChange={vi.fn()}
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
        error="Invalid URL"
        successMessage={null}
        urlHint="Use a full URL like https://example.com"
        urlHintTone="error"
        isDiscoverDisabled={true}
        isSubmitDisabled={true}
        labels={{
          title: "Add Feed",
          description: "Add a feed from a URL or website",
          urlLabel: "Feed",
          urlPlaceholder: "https://example.com/feed.xml",
          discover: "Discover",
          discovering: "Discovering",
          cancel: "Cancel",
          add: "Add",
          adding: "Adding",
        }}
        onSubmit={vi.fn()}
      />,
    );

    const urlInput = screen.getByRole("textbox", { name: "Feed" });
    const urlLabel = screen.getByText("Feed").closest("label");
    const helperText = screen.getByText("Use a full URL like https://example.com");

    expect(urlInput.id).not.toBe("");
    expect(urlLabel).not.toBeNull();
    expect(urlLabel).toHaveAttribute("for", urlInput.id);
    expect(urlInput).toHaveAccessibleDescription("Use a full URL like https://example.com");
    expect(urlInput).toHaveAttribute("aria-errormessage", helperText.id);
    expect(urlInput).toHaveAttribute("aria-invalid", "true");
  });

  it("keeps discovery disabled and busy while discovery is pending", async () => {
    const user = userEvent.setup();
    const onDiscover = vi.fn();

    render(
      <AddFeedDialogView
        open={true}
        onOpenChange={vi.fn()}
        url="https://example.com"
        onUrlChange={vi.fn()}
        onDiscover={onDiscover}
        discovering
        loading={false}
        discoveredFeedsFoundLabel={null}
        discoveredFeedOptions={[]}
        selectedFeedUrl=""
        onSelectedFeedUrlChange={vi.fn()}
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
        error={null}
        successMessage={null}
        urlHint={null}
        urlHintTone="muted"
        isDiscoverDisabled={false}
        isSubmitDisabled={false}
        labels={{
          title: "Add Feed",
          description: "Add a feed from a URL or website",
          urlLabel: "Feed",
          urlPlaceholder: "https://example.com/feed.xml",
          discover: "Discover",
          discovering: "Discovering",
          cancel: "Cancel",
          add: "Add",
          adding: "Adding",
        }}
        onSubmit={vi.fn()}
      />,
    );

    const discoverButton = screen.getByRole("button", { name: "Discovering" });

    expect(discoverButton).toBeDisabled();
    expect(discoverButton).toHaveAttribute("aria-busy", "true");

    await user.click(discoverButton);

    expect(onDiscover).not.toHaveBeenCalled();
  });
});
