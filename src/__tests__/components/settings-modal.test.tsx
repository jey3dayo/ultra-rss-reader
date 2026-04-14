import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ActionsSettings } from "@/components/settings/actions-settings";
import { ReadingSettings } from "@/components/settings/reading-settings";
import { SettingsModal } from "@/components/settings/settings-modal";
import type { SettingsModalViewProps } from "@/components/settings/settings-modal-view";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";
import { createWrapper } from "../../../tests/helpers/create-wrapper";
import { sampleAccounts, setupTauriMocks } from "../../../tests/helpers/tauri-mocks";

vi.mock("@/components/settings/settings-modal-view", () => ({
  SettingsModalView: ({
    open,
    title,
    closeLabel,
    navigation,
    accountsNavigation,
    content,
    onClose,
  }: SettingsModalViewProps) =>
    open ? (
      <div>
        <h1>{title}</h1>
        <button type="button" onClick={onClose}>
          {closeLabel}
        </button>
        <div>{navigation}</div>
        <div>{accountsNavigation}</div>
        <div>{content}</div>
      </div>
    ) : null,
}));

describe("SettingsModal", () => {
  beforeEach(() => {
    useUiStore.setState(useUiStore.getInitialState());
    useUiStore.getState().openSettings();
    setupTauriMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  function QueryClientCapture({ onReady }: { onReady: (queryClient: QueryClient) => void }) {
    const queryClient = useQueryClient();

    useEffect(() => {
      onReady(queryClient);
    }, [onReady, queryClient]);

    return null;
  }

  function createWrapperWithClient(onReady: (queryClient: QueryClient) => void) {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    return function Wrapper({ children }: { children: React.ReactNode }) {
      return (
        <QueryClientProvider client={queryClient}>
          <QueryClientCapture onReady={onReady} />
          {children}
        </QueryClientProvider>
      );
    };
  }

  it("closes the modal when the view requests it", async () => {
    const user = userEvent.setup();

    render(<SettingsModal />, { wrapper: createWrapper() });

    await user.click(screen.getByRole("button", { name: "Close preferences" }));

    await waitFor(() => {
      expect(useUiStore.getState().settingsOpen).toBe(false);
    });
  });

  it("passes fetched accounts into the accounts navigation slot", async () => {
    render(<SettingsModal />, { wrapper: createWrapper() });

    expect(await screen.findByRole("button", { name: /Local/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /FreshRSS/i })).toBeInTheDocument();
  });

  it("does not fall back to general settings on a cold accounts open while accounts are unresolved", () => {
    setupTauriMocks((cmd) => {
      if (cmd === "list_accounts") {
        return new Promise(() => {});
      }
      return null;
    });
    useUiStore.setState(useUiStore.getInitialState());
    useUiStore.getState().openSettings("accounts");

    render(<SettingsModal />, { wrapper: createWrapper() });

    expect(screen.queryByRole("switch", { name: "Show Unread" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("account-detail-layout")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Add account/i })).toBeInTheDocument();
  });

  it("keeps account navigation and detail visible during reset and recovers stale selection to a valid account", async () => {
    usePreferencesStore.setState({
      prefs: { selected_account_id: "acc-1" },
      loaded: true,
    });
    useUiStore.setState(useUiStore.getInitialState());
    useUiStore.getState().openSettings("accounts");

    let queryClient: QueryClient | undefined;
    render(<SettingsModal />, {
      wrapper: createWrapperWithClient((captured) => {
        queryClient = captured;
      }),
    });

    expect(await screen.findByRole("button", { name: /Local/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /FreshRSS/i })).toBeInTheDocument();
    expect(screen.getByTestId("account-detail-layout")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Local" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Local/i })).toHaveClass("bg-sidebar-accent");
    expect(screen.getByRole("button", { name: /FreshRSS/i })).not.toHaveClass("bg-sidebar-accent");

    await act(async () => {
      queryClient?.setQueryData(["accounts"], undefined);
    });

    expect(screen.getByTestId("account-detail-layout")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Local" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Local/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /FreshRSS/i })).toBeInTheDocument();

    await act(async () => {
      queryClient?.setQueryData(["accounts"], [sampleAccounts[1]]);
    });

    await waitFor(() => {
      expect(useUiStore.getState().settingsAccountId).toBe("acc-2");
    });

    expect(screen.getByTestId("account-detail-layout")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "FreshRSS" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Local/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /FreshRSS/i })).toHaveClass("bg-sidebar-accent");
  });

  it("does not keep showing a deleted account while accounts are pending after delete", async () => {
    const user = userEvent.setup();
    let queryClient: QueryClient | undefined;
    let listedAccounts = [...sampleAccounts];
    let pauseAccountsQuery = false;

    setupTauriMocks((cmd) => {
      if (cmd === "list_accounts") {
        return pauseAccountsQuery ? new Promise(() => {}) : listedAccounts;
      }
      if (cmd === "delete_account") {
        listedAccounts = [sampleAccounts[1]];
        pauseAccountsQuery = true;
        return null;
      }
      return null;
    });

    usePreferencesStore.setState({
      prefs: { selected_account_id: "acc-1" },
      loaded: true,
    });
    useUiStore.setState(useUiStore.getInitialState());
    useUiStore.getState().openSettings("accounts");

    render(<SettingsModal />, {
      wrapper: createWrapperWithClient((captured) => {
        queryClient = captured;
      }),
    });

    expect(await screen.findByRole("heading", { level: 2, name: "Local" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Delete Account" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(useUiStore.getState().settingsAccountId).toBe("acc-2");
    });

    expect(screen.queryByRole("heading", { level: 2, name: "Local" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "FreshRSS" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Local/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /FreshRSS/i })).toHaveClass("bg-sidebar-accent");

    await act(async () => {
      queryClient?.setQueryData(["accounts"], [sampleAccounts[1]]);
    });

    expect(screen.queryByRole("heading", { level: 2, name: "Local" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "FreshRSS" })).toBeInTheDocument();
  });

  it("does not resurrect a deleted account when reopening the modal while accounts are still pending", async () => {
    const user = userEvent.setup();
    let listedAccounts = [...sampleAccounts];
    let pauseAccountsQuery = false;

    setupTauriMocks((cmd) => {
      if (cmd === "list_accounts") {
        return pauseAccountsQuery ? new Promise(() => {}) : listedAccounts;
      }
      if (cmd === "delete_account") {
        listedAccounts = [sampleAccounts[1]];
        pauseAccountsQuery = true;
        return null;
      }
      return null;
    });

    usePreferencesStore.setState({
      prefs: { selected_account_id: "acc-1" },
      loaded: true,
    });
    useUiStore.setState(useUiStore.getInitialState());
    useUiStore.getState().openSettings("accounts");

    render(<SettingsModal />, { wrapper: createWrapper() });

    expect(await screen.findByRole("heading", { level: 2, name: "Local" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Delete Account" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(useUiStore.getState().settingsAccountId).toBe("acc-2");
    });

    act(() => {
      useUiStore.getState().closeSettings();
    });

    act(() => {
      useUiStore.getState().openSettings("accounts");
    });

    expect(screen.queryByRole("heading", { level: 2, name: "Local" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "FreshRSS" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Local/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /FreshRSS/i })).toBeInTheDocument();
  });

  it("prefers the saved account when opening the accounts section", async () => {
    usePreferencesStore.setState({
      prefs: { selected_account_id: "acc-2" },
      loaded: true,
    });
    useUiStore.setState(useUiStore.getInitialState());
    useUiStore.getState().openSettings("accounts");

    render(<SettingsModal />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(useUiStore.getState().settingsAccountId).toBe("acc-2");
    });
  });

  it("shows the debug category in navigation", async () => {
    const user = userEvent.setup();

    render(<SettingsModal />, { wrapper: createWrapper() });

    await user.click(screen.getByRole("button", { name: "Debug" }));

    expect(screen.getByRole("button", { name: "Debug" })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Show layout HUD" })).toBeInTheDocument();
  });

  it("shows default enabled states in actions settings when preferences are unset", () => {
    usePreferencesStore.setState({ prefs: {}, loaded: true });

    render(<ActionsSettings />, { wrapper: createWrapper() });

    const switches = screen.getAllByRole("switch");
    expect(switches).toHaveLength(1);
    expect(switches[0]).toBeChecked();
  });

  it("shows default display mode options in reading settings", () => {
    usePreferencesStore.setState({
      prefs: { reader_mode_default: "true", web_preview_mode_default: "true" },
      loaded: true,
    });

    render(<ReadingSettings />, { wrapper: createWrapper() });

    expect(screen.getByRole("combobox", { name: "Default display mode" })).toHaveTextContent("Preview");
  });

  it("opens the default display mode select for the display-mode showcase intent", async () => {
    vi.stubEnv("DEV", true);
    vi.stubEnv("VITE_DEV_INTENT", "open-settings-reading-display-mode");
    usePreferencesStore.setState({
      prefs: { reader_mode_default: "true", web_preview_mode_default: "false" },
      loaded: true,
    });

    render(<ReadingSettings />, { wrapper: createWrapper() });

    expect(screen.getByRole("combobox", { name: "Default display mode" })).toHaveAttribute("aria-expanded", "true");
    expect(await screen.findByRole("option", { name: "Standard" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Preview" })).toBeInTheDocument();
  });
});
