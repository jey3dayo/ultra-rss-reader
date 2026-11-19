import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AddFeedDialogView, type AddFeedDialogViewProps } from "@/components/reader/add-feed-dialog-view";

const defaultProps: AddFeedDialogViewProps = {
  open: true,
  onOpenChange: vi.fn(),
  url: "https://example.com",
  onUrlChange: vi.fn(),
  onDiscover: vi.fn(),
  discovering: false,
  loading: false,
  discoveredFeedsFoundLabel: null,
  discoveredFeedOptions: [],
  selectedFeedUrl: "",
  onSelectedFeedUrlChange: vi.fn(),
  folderSelectProps: {
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
  },
  error: null,
  successMessage: null,
  urlHint: null,
  urlHintTone: "muted",
  isDiscoverDisabled: false,
  isSubmitDisabled: false,
  labels: {
    title: "Add feed",
    description: "Add a feed from a URL or website",
    account: null,
    urlLabel: "Feed",
    urlPlaceholder: "https://example.com/feed.xml",
    discover: "Discover",
    discovering: "Discovering",
    cancel: "Cancel",
    add: "Add",
    adding: "Adding",
  },
  onSubmit: vi.fn(),
};

describe("AddFeedDialogView", () => {
  it("renders the dialog layout and delegates display interactions", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onDiscover = vi.fn();
    const onSelectedFeedUrlChange = vi.fn();
    const onSubmit = vi.fn();

    render(
      <AddFeedDialogView
        {...defaultProps}
        onOpenChange={onOpenChange}
        onDiscover={onDiscover}
        discoveredFeedsFoundLabel="Found 2 feeds"
        discoveredFeedOptions={[
          { value: "https://example.com/feed.xml", label: "Tech Blog" },
          { value: "https://example.com/atom.xml", label: "News Feed" },
        ]}
        selectedFeedUrl="https://example.com/feed.xml"
        onSelectedFeedUrlChange={onSelectedFeedUrlChange}
        folderSelectProps={{
          ...defaultProps.folderSelectProps,
          value: "__new__",
          isCreatingFolder: true,
          newFolderName: "Reading",
        }}
        successMessage="Feed detected"
        urlHint="Paste a feed or site URL."
        labels={{ ...defaultProps.labels, account: "Add to: Personal RSS" }}
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByRole("dialog")).toHaveAccessibleDescription(
      "Add to: Personal RSS Add a feed from a URL or website",
    );
    expect(screen.getByLabelText("Feed")).toHaveValue("https://example.com");
    expect(screen.queryByText("Paste a feed or site URL.")).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Folder" })).toHaveTextContent("New folder");
    expect(screen.getByLabelText("Folder name")).toHaveValue("Reading");
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
    expect(screen.getByRole("status")).toHaveAttribute("aria-atomic", "true");
    expect(screen.getByRole("status")).toHaveTextContent("Feed detected");

    await user.click(screen.getByRole("button", { name: "Discover" }));
    await user.click(screen.getByText("News Feed"));
    await user.click(screen.getByRole("button", { name: "Add" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onDiscover).toHaveBeenCalled();
    expect(onSelectedFeedUrlChange.mock.calls.map(([value]) => value)).toContain("https://example.com/atom.xml");
    expect(onSubmit).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("does not submit the form when submission is disabled", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <AddFeedDialogView
        {...defaultProps}
        url="example.com"
        error="Invalid URL"
        urlHint="Use a full URL like https://example.com"
        urlHintTone="error"
        isDiscoverDisabled={true}
        isSubmitDisabled={true}
        onSubmit={onSubmit}
      />,
    );

    const urlInput = screen.getByRole("textbox", { name: "Feed" });
    await user.type(urlInput, "{Enter}");

    const helperText = screen.getByText("Use a full URL like https://example.com");

    expect(screen.getByRole("status")).toHaveTextContent("Invalid URL");
    expect(urlInput).toHaveAccessibleDescription("Use a full URL like https://example.com");
    expect(urlInput).toHaveAttribute("aria-errormessage", helperText.id);
    expect(urlInput).toHaveAttribute("aria-invalid", "true");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("associates discovered feed descriptions and folder select labels with their controls", () => {
    render(
      <AddFeedDialogView
        {...defaultProps}
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
        folderSelectProps={{
          ...defaultProps.folderSelectProps,
          value: "folder-1",
          options: [
            { value: "", label: "No folder" },
            { value: "folder-1", label: "Work" },
          ],
        }}
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
    expect(screen.getByRole("combobox", { name: "Folder" })).toHaveAttribute("aria-labelledby", "folder-label");
  });

  it("keeps discovery disabled and busy while discovery is pending", async () => {
    const user = userEvent.setup();
    const onDiscover = vi.fn();

    render(<AddFeedDialogView {...defaultProps} onDiscover={onDiscover} discovering />);

    const discoverButton = screen.getByRole("button", { name: "Discovering" });

    expect(discoverButton).toBeDisabled();
    expect(discoverButton).toHaveAttribute("aria-busy", "true");

    await user.click(discoverButton);

    expect(onDiscover).not.toHaveBeenCalled();
  });
});
