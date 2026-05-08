import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createQueryWrapper, createWrapper } from "@tests/helpers/create-wrapper";
import { setupTauriMocks } from "@tests/helpers/tauri-mocks";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AddAccountForm } from "@/components/settings/add-account-form";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";

const servicePickerSource = readFileSync(
  join(process.cwd(), "src/components/settings/add-account/service-picker.tsx"),
  "utf8",
);
const accountConfigFormSource = readFileSync(
  join(process.cwd(), "src/components/settings/account-config-form.tsx"),
  "utf8",
);

async function selectService(user: ReturnType<typeof userEvent.setup>, serviceName: string) {
  await user.click(screen.getByRole("button", { name: new RegExp(serviceName) }));
}

function setupPendingAddAccount(onArgs?: (args: Record<string, unknown>) => void) {
  let resolveAddAccount: ((value: unknown) => void) | undefined;

  setupTauriMocks((cmd, args) => {
    if (cmd !== "add_account") {
      return null;
    }

    onArgs?.(args);
    return new Promise<unknown>((resolve) => {
      resolveAddAccount = resolve;
    });
  });

  return {
    resolve(value: unknown) {
      if (!resolveAddAccount) {
        throw new Error("add_account did not start");
      }

      resolveAddAccount(value);
    },
  };
}

describe("AddAccountForm", () => {
  beforeEach(() => {
    useUiStore.setState(useUiStore.getInitialState());
    usePreferencesStore.setState({ prefs: {}, loaded: true });
  });

  it("renders the service picker with categories", () => {
    render(<AddAccountForm />, { wrapper: createWrapper() });

    expect(screen.getByText("Local Feeds")).toBeInTheDocument();
    expect(screen.getByText("FreshRSS")).toBeInTheDocument();
    expect(screen.getByText("Feedly")).toBeInTheDocument();
    expect(screen.getByText("Fever")).toBeInTheDocument();
  });

  it("can start directly on the provider config screen for debugging", async () => {
    const user = userEvent.setup();

    render(<AddAccountForm initialKind="FreshRss" />, { wrapper: createWrapper() });

    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Server URL")).toBeInTheDocument();
    expect(screen.queryByText("Local Feeds")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Back/ }));

    await waitFor(() => {
      expect(screen.getByText("Local Feeds")).toBeInTheDocument();
    });
  });

  it("can render a fixed loading state for Storybook debugging", () => {
    render(
      <AddAccountForm
        initialKind="FreshRss"
        debugState={{
          name: "Work RSS",
          serverUrl: "https://freshrss.example.com",
          username: "alice",
          password: "secret",
          submitting: true,
        }}
      />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByLabelText("Name")).toHaveValue("Work RSS");
    expect(screen.getByLabelText("Server URL")).toHaveValue("https://freshrss.example.com");
    expect(screen.getByLabelText("Username")).toHaveValue("alice");
    expect(screen.getByLabelText("Password")).toHaveValue("secret");
    expect(screen.getByRole("button", { name: "Testing connection…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  });

  it("intercepts submit in Storybook debug mode instead of calling the Tauri command", async () => {
    const user = userEvent.setup();
    const addAccountCalls = vi.fn();

    setupTauriMocks((cmd) => {
      if (cmd === "add_account") {
        addAccountCalls();
      }
      return null;
    });

    render(
      <AddAccountForm
        initialKind="FreshRss"
        debugState={{
          name: "Work RSS",
          serverUrl: "https://freshrss.example.com",
          username: "alice",
          password: "secret",
          submitMessage: "Storybook preview only",
        }}
      />,
      { wrapper: createWrapper() },
    );

    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(addAccountCalls).not.toHaveBeenCalled();
    expect(screen.getByText("Storybook preview only")).toBeInTheDocument();
  });

  it("shows planned services as disabled with a coming-soon label", () => {
    render(<AddAccountForm />, { wrapper: createWrapper() });

    const feverButton = screen.getByRole("button", { name: /Fever/ });
    const feedlyButton = screen.getByRole("button", { name: /Feedly/ });

    expect(feverButton).toBeDisabled();
    expect(feedlyButton).toBeDisabled();
    expect(screen.getByText("Deprecated. Not recommended.")).toBeInTheDocument();
    expect(screen.getByText("On hold due to enterprise-only API access")).toBeInTheDocument();
  });

  it("delegates hover styling to the shared nav row button", () => {
    expect(servicePickerSource).not.toContain("hover:border-border");
    expect(servicePickerSource).not.toContain("hover:bg-surface-2");

    render(<AddAccountForm />, { wrapper: createWrapper() });

    const freshrssButton = screen.getByRole("button", { name: /FreshRSS/ });

    expect(freshrssButton).toHaveClass("rounded-md", "px-3", "py-2.5");
    expect(freshrssButton.querySelector(".lucide-chevron-right")).toHaveClass("text-foreground-soft");
  });

  it("wraps the picker in a semantic surface shell", () => {
    render(<AddAccountForm />, { wrapper: createWrapper() });

    expect(screen.getByTestId("service-picker-surface")).toHaveClass(
      "rounded-lg",
      "border",
      "border-border",
      "bg-surface-1",
      "shadow-elevation-1",
    );
  });

  it("keeps the service row and icon badge on the rounded-md baseline", () => {
    expect(servicePickerSource).toContain('className={cn("items-center rounded-md px-3 py-2.5")}');
    expect(servicePickerSource).toContain(
      'className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-md", service.iconBg)}',
    );
    expect(accountConfigFormSource).toContain(
      'className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-md", serviceDef.iconBg)}',
    );
  });

  it("navigates to config form on service selection and back", async () => {
    const user = userEvent.setup();
    render(<AddAccountForm />, { wrapper: createWrapper() });

    await selectService(user, "FreshRSS");

    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Server URL")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Back/ })).toHaveClass("text-foreground-soft");
    expect(screen.getByText("freshrss.org")).toHaveClass("text-foreground-soft");
    expect(screen.getByLabelText("Name")).toHaveClass("w-full");
    expect(screen.getByLabelText("Server URL")).toHaveClass("w-full");
    expect(screen.getByLabelText("Server URL")).toHaveClass("h-10");
    expect(screen.getByLabelText("Username")).toHaveClass("h-10");
    expect(screen.getByLabelText("Password")).toHaveClass("h-10");
    expect(screen.getByText("Server URL")).toHaveClass("sm:w-40");

    await user.click(screen.getByRole("button", { name: /Back/ }));

    await waitFor(() => {
      expect(screen.getByText("Local Feeds")).toBeInTheDocument();
    });
  });

  it("does not navigate to the config form when a planned service is clicked", async () => {
    const user = userEvent.setup();
    render(<AddAccountForm />, { wrapper: createWrapper() });

    await user.click(screen.getByRole("button", { name: /Feedly/ }));

    expect(screen.getByText("Local Feeds")).toBeInTheDocument();
    expect(screen.queryByLabelText("Name")).not.toBeInTheDocument();
  });

  it("shows a toast and skips the IPC call when FreshRSS fields are missing", async () => {
    let addAccountCalls = 0;
    setupTauriMocks((cmd) => {
      if (cmd === "add_account") {
        addAccountCalls += 1;
      }
      return null;
    });

    const user = userEvent.setup();
    render(<AddAccountForm />, { wrapper: createWrapper() });

    await selectService(user, "FreshRSS");
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => {
      expect(useUiStore.getState().toastMessage).toEqual({ message: "Server URL is required" });
    });
    expect(addAccountCalls).toBe(0);
  });

  it("shows network error toast when connection to FreshRSS server fails", async () => {
    setupTauriMocks((cmd) => {
      if (cmd === "add_account") {
        throw { type: "Retryable", message: "Network error: connection refused" };
      }
      return null;
    });

    const user = userEvent.setup();
    render(<AddAccountForm />, { wrapper: createWrapper() });

    await selectService(user, "FreshRSS");
    await user.type(screen.getByLabelText("Server URL"), "https://bad-server.example.com");
    await user.type(screen.getByLabelText("Username"), "alice");
    await user.type(screen.getByLabelText("Password"), "secret");
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => {
      expect(useUiStore.getState().toastMessage).toEqual({
        message: "Cannot connect to server. Please check the URL",
      });
    });
  });

  it("shows auth error with FreshRSS API password hint when authentication fails", async () => {
    setupTauriMocks((cmd) => {
      if (cmd === "add_account") {
        throw { type: "UserVisible", message: "Auth error: Authentication failed: 403" };
      }
      return null;
    });

    const user = userEvent.setup();
    render(<AddAccountForm />, { wrapper: createWrapper() });

    await selectService(user, "FreshRSS");
    await user.type(screen.getByLabelText("Server URL"), "https://freshrss.example.com");
    await user.type(screen.getByLabelText("Username"), "alice");
    await user.type(screen.getByLabelText("Password"), "wrong-password");
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => {
      const toast = useUiStore.getState().toastMessage;
      expect(toast?.message).toContain("Authentication failed");
      expect(toast?.message).toContain("API password");
    });
  });

  it("shows 'Testing connection…' button text while submitting FreshRSS account", async () => {
    const addAccount = setupPendingAddAccount();

    const user = userEvent.setup();
    render(<AddAccountForm />, { wrapper: createWrapper() });

    await selectService(user, "FreshRSS");
    await user.type(screen.getByLabelText("Server URL"), "https://freshrss.example.com");
    await user.type(screen.getByLabelText("Username"), "alice");
    await user.type(screen.getByLabelText("Password"), "secret");
    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(screen.getByRole("button", { name: "Testing connection…" })).toBeDisabled();

    addAccount.resolve({
      id: "acc-new",
      kind: "FreshRss",
      name: "FreshRSS",
      username: "alice",
      server_url: "https://freshrss.example.com",
      sync_interval_secs: 3600,
      sync_on_wake: false,
      keep_read_items_days: 30,
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Add" })).not.toBeDisabled();
    });
  });

  it("submits Local account and disables controls while the request is pending", async () => {
    const addAccountCalls = vi.fn();
    const addAccount = setupPendingAddAccount(addAccountCalls);

    const user = userEvent.setup();
    render(<AddAccountForm />, { wrapper: createWrapper() });

    await selectService(user, "Local Feeds");
    await user.type(screen.getByLabelText("Name"), "Work RSS");
    await user.keyboard("{Enter}");

    const addButton = screen.getByRole("button", { name: "Adding…" });
    expect(addAccountCalls).toHaveBeenCalledTimes(1);
    expect(addButton).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByLabelText("Name")).toBeDisabled();

    addAccount.resolve({
      id: "acc-new",
      kind: "Local",
      name: "Work RSS",
      server_url: null,
      sync_interval_secs: 3600,
      sync_on_wake: false,
      keep_read_items_days: 30,
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Add" })).not.toBeDisabled();
    });
  });

  it("starts an account setup session after successful registration", async () => {
    const user = userEvent.setup();
    let releaseSync = () => {};

    setupTauriMocks((cmd) => {
      if (cmd === "add_account") {
        return {
          id: "acc-new",
          kind: "FreshRss",
          name: "FreshRSS",
          username: "alice",
          server_url: "https://freshrss.example.com",
          sync_interval_secs: 3600,
          sync_on_startup: true,
          sync_on_wake: false,
          keep_read_items_days: 30,
        };
      }
      if (cmd === "trigger_sync_account") {
        return new Promise((resolve) => {
          releaseSync = () => resolve({ synced: true, total: 1, succeeded: 1, failed: [], warnings: [] });
        });
      }
      return null;
    });

    render(<AddAccountForm />, { wrapper: createWrapper() });

    await selectService(user, "FreshRSS");
    await user.type(screen.getByLabelText("Server URL"), "https://freshrss.example.com");
    await user.type(screen.getByLabelText("Username"), "alice");
    await user.type(screen.getByLabelText("Password"), "secret");
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => {
      expect(useUiStore.getState().selectedAccountId).toBe("acc-new");
      expect(useUiStore.getState().settingsAccountId).toBe("acc-new");
      expect(useUiStore.getState().accountSetupSession).toEqual({
        accountId: "acc-new",
        state: "syncing",
      });
    });

    releaseSync();
  });

  it("adds the new account to the accounts query cache immediately after registration", async () => {
    const user = userEvent.setup();
    const { queryClient, wrapper } = createQueryWrapper();

    setupTauriMocks((cmd) => {
      if (cmd === "add_account") {
        return {
          id: "acc-new",
          kind: "FreshRss",
          name: "FreshRSS",
          username: "alice",
          server_url: "https://freshrss.example.com",
          sync_interval_secs: 3600,
          sync_on_startup: true,
          sync_on_wake: false,
          keep_read_items_days: 30,
        };
      }
      if (cmd === "trigger_sync_account") {
        return new Promise(() => {});
      }
      return null;
    });

    render(<AddAccountForm />, { wrapper });

    await selectService(user, "FreshRSS");
    await user.type(screen.getByLabelText("Server URL"), "https://freshrss.example.com");
    await user.type(screen.getByLabelText("Username"), "alice");
    await user.type(screen.getByLabelText("Password"), "secret");
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => {
      expect(queryClient?.getQueryData(["accounts"])).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "acc-new",
            name: "FreshRSS",
          }),
        ]),
      );
    });
  });
});
