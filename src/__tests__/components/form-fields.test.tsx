import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AddFeedDialog } from "@/components/reader/add-feed-dialog";
import { RenameDialog } from "@/components/reader/rename-feed-dialog";
import { AddAccountForm } from "@/components/settings/add-account-form";
import { SettingsSelect, SettingsSwitch } from "@/components/settings/settings-components";
import { usePreferencesStore } from "@/stores/preferences-store";
import { createWrapper } from "../../../tests/helpers/create-wrapper";
import { sampleFeeds, setupTauriMocks, teardownTauriMocks } from "../../../tests/helpers/tauri-mocks";

const sampleFolders = [
  { id: "folder-1", account_id: "acc-1", name: "Work", sort_order: 0 },
  { id: "folder-2", account_id: "acc-1", name: "Personal", sort_order: 1 },
];

describe("Form fields", () => {
  beforeEach(() => {
    usePreferencesStore.setState({ prefs: {}, loaded: true });
    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_folders":
          return sampleFolders.filter((folder) => folder.account_id === args.accountId);
        case "discover_feeds":
          return [
            { url: "https://example.com/feed.xml", title: "Tech Blog" },
            { url: "https://example.com/atom.xml", title: "News Feed" },
          ];
        default:
          return null;
      }
    });
  });

  afterEach(() => {
    teardownTauriMocks();
    usePreferencesStore.setState({ prefs: {}, loaded: false });
  });

  it("settings select exposes a name attribute", () => {
    const { container } = render(
      <SettingsSelect
        label="Open links"
        prefKey="open_links"
        options={[
          { value: "in_app", label: "In-app browser" },
          { value: "external", label: "Default browser" },
        ]}
      />,
      { wrapper: createWrapper() },
    );

    expect(container.querySelector('input[name="open_links"]')).not.toBeNull();
  });

  it("settings select exposes an accessible name and selected label", () => {
    usePreferencesStore.setState({ prefs: { open_links: "default_browser" }, loaded: true });

    render(
      <SettingsSelect
        label="Open links"
        prefKey="open_links"
        options={[
          { value: "in_app", label: "In-app browser" },
          { value: "default_browser", label: "Default browser" },
        ]}
      />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByRole("combobox", { name: "Open links" })).toHaveTextContent("Default browser");
  });

  it("settings select falls back to the default option label when the preference is unset", () => {
    render(
      <SettingsSelect
        label="Open links"
        prefKey="open_links"
        options={[
          { value: "in_app", label: "In-app browser" },
          { value: "default_browser", label: "Default browser" },
        ]}
      />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByRole("combobox", { name: "Open links" })).toHaveTextContent("In-app browser");
  });

  it("settings switch is associated with its label", () => {
    render(<SettingsSwitch label="Open links in background" prefKey="open_links_background" />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByRole("switch", { name: "Open links in background" })).toBeInTheDocument();
  });

  it("settings switch falls back to the default checked state when the preference is unset", () => {
    render(<SettingsSwitch label="Ask before" prefKey="ask_before_mark_all" />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByRole("switch", { name: "Ask before" })).toBeChecked();
  });

  it("add account form inputs expose name attributes after service selection", async () => {
    const user = userEvent.setup();
    render(<AddAccountForm />, { wrapper: createWrapper() });

    // Select FreshRSS from the service picker
    await user.click(screen.getByRole("button", { name: /FreshRSS/ }));

    expect(screen.getByLabelText("Name")).toHaveAttribute("name");
    expect(screen.getByLabelText("Server URL")).toHaveAttribute("name");
    expect(screen.getByLabelText("Username")).toHaveAttribute("name");
    expect(screen.getByLabelText("Password")).toHaveAttribute("name");
  });

  it("add account service picker shows available services", () => {
    render(<AddAccountForm />, { wrapper: createWrapper() });

    expect(screen.getByRole("button", { name: /Local Feeds/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /FreshRSS/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Inoreader/ })).toBeInTheDocument();
  });

  it("add feed dialog input exposes a name attribute", () => {
    render(<AddFeedDialog open={true} onOpenChange={() => {}} accountId="acc-1" />, { wrapper: createWrapper() });

    expect(screen.getByPlaceholderText("Feed or Site URL")).toHaveAttribute("name");
  });

  it("add feed dialog folder select exposes an accessible name and selected folder label", async () => {
    const user = userEvent.setup();

    render(<AddFeedDialog open={true} onOpenChange={() => {}} accountId="acc-1" />, { wrapper: createWrapper() });

    const folderSelect = await screen.findByRole("combobox", { name: "Folder" });
    await user.click(folderSelect);
    await user.click(await screen.findByRole("option", { name: "Work" }));

    await waitFor(() => {
      expect(screen.getByRole("combobox", { name: "Folder" })).toHaveTextContent("Work");
    });
  });

  it("add feed dialog discovered feed radios expose accessible names", async () => {
    const user = userEvent.setup();

    render(<AddFeedDialog open={true} onOpenChange={() => {}} accountId="acc-1" />, {
      wrapper: createWrapper(),
    });

    await user.type(screen.getByPlaceholderText("Feed or Site URL"), "https://example.com");
    await user.click(screen.getByRole("button", { name: "Discover" }));

    await waitFor(() => {
      expect(document.body.querySelector('[role="radio"][aria-label="Tech Blog"]')).not.toBeNull();
      expect(document.body.querySelector('[role="radio"][aria-label="News Feed"]')).not.toBeNull();
    });
  });

  it("add feed dialog rejects invalid manual URLs before discovery or submit", async () => {
    const user = userEvent.setup();

    render(<AddFeedDialog open={true} onOpenChange={() => {}} accountId="acc-1" />, {
      wrapper: createWrapper(),
    });

    const input = screen.getByPlaceholderText("Feed or Site URL");
    await user.type(input, "example.com");

    expect(input).toBeInvalid();
    expect(screen.getByRole("button", { name: "Discover" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
  });

  it("rename feed dialog input exposes a name attribute", () => {
    render(<RenameDialog feed={sampleFeeds[0]} open={true} onOpenChange={() => {}} />, { wrapper: createWrapper() });

    expect(screen.getByDisplayValue(sampleFeeds[0].title)).toHaveAttribute("name");
  });

  it("rename feed dialog selects expose accessible names and selected labels", async () => {
    render(
      <RenameDialog
        feed={{ ...sampleFeeds[0], folder_id: "folder-1", reader_mode: "on", web_preview_mode: "on" }}
        open={true}
        onOpenChange={() => {}}
      />,
      { wrapper: createWrapper() },
    );

    expect(await screen.findByRole("combobox", { name: "Display Mode" })).toHaveTextContent("Preview");
    expect(await screen.findByRole("combobox", { name: "Folder" })).toHaveTextContent("Work");
  });

  it("rename feed dialog offers a default display mode option for inheriting the global setting", async () => {
    const user = userEvent.setup();

    render(
      <RenameDialog
        feed={{ ...sampleFeeds[0], reader_mode: "inherit", web_preview_mode: "inherit" }}
        open={true}
        onOpenChange={() => {}}
      />,
      {
        wrapper: createWrapper(),
      },
    );

    await user.click(await screen.findByRole("combobox", { name: "Display Mode" }));

    expect(await screen.findByRole("option", { name: "Default display mode" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Standard" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Preview" })).toBeInTheDocument();
  });

  it("rename feed dialog offers a new folder option even when no folders exist yet", async () => {
    const user = userEvent.setup();

    teardownTauriMocks();
    setupTauriMocks((cmd) => {
      switch (cmd) {
        case "list_folders":
          return [];
        default:
          return null;
      }
    });

    render(<RenameDialog feed={sampleFeeds[0]} open={true} onOpenChange={() => {}} />, {
      wrapper: createWrapper(),
    });

    await user.click(await screen.findByRole("combobox", { name: "Folder" }));

    expect(await screen.findByRole("option", { name: "New Folder…" })).toBeInTheDocument();
  });
});
