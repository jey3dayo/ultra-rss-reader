import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AddAccountForm } from "@/components/settings/add-account-form";
import { useUiStore } from "@/stores/ui-store";
import { createWrapper } from "../../../tests/helpers/create-wrapper";
import { setupTauriMocks } from "../../../tests/helpers/tauri-mocks";

async function selectService(user: ReturnType<typeof userEvent.setup>, serviceName: string) {
  await user.click(screen.getByRole("button", { name: new RegExp(serviceName) }));
}

describe("AddAccountForm", () => {
  beforeEach(() => {
    useUiStore.setState(useUiStore.getInitialState());
  });

  it("renders the service picker with categories", () => {
    render(<AddAccountForm />, { wrapper: createWrapper() });

    expect(screen.getByText("Local Feeds")).toBeInTheDocument();
    expect(screen.getByText("FreshRSS")).toBeInTheDocument();
    expect(screen.getByText("Inoreader")).toBeInTheDocument();
    expect(screen.getByText("Fever")).toBeInTheDocument();
  });

  it("shows Fever as disabled", () => {
    render(<AddAccountForm />, { wrapper: createWrapper() });

    const feverButton = screen.getByRole("button", { name: /Fever/ });
    expect(feverButton).toBeDisabled();
  });

  it("navigates to config form on service selection and back", async () => {
    const user = userEvent.setup();
    render(<AddAccountForm />, { wrapper: createWrapper() });

    await selectService(user, "FreshRSS");

    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Server URL")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Back/ }));

    await waitFor(() => {
      expect(screen.getByText("Local Feeds")).toBeInTheDocument();
    });
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

  it("shows 'Testing connection...' button text while submitting FreshRSS account", async () => {
    let resolveAddAccount: ((value: unknown) => void) | null = null;

    setupTauriMocks((cmd) => {
      if (cmd === "add_account") {
        return new Promise<unknown>((resolve) => {
          resolveAddAccount = resolve;
        });
      }
      return null;
    });

    const user = userEvent.setup();
    render(<AddAccountForm />, { wrapper: createWrapper() });

    await selectService(user, "FreshRSS");
    await user.type(screen.getByLabelText("Server URL"), "https://freshrss.example.com");
    await user.type(screen.getByLabelText("Username"), "alice");
    await user.type(screen.getByLabelText("Password"), "secret");
    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(screen.getByRole("button", { name: "Testing connection..." })).toBeDisabled();

    // Clean up
    const resolve = resolveAddAccount as ((value: unknown) => void) | null;
    if (!resolve) {
      throw new Error("add_account did not start");
    }

    resolve({
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
    let resolveAddAccount: ((value: unknown) => void) | null = null;
    const addAccountCalls = vi.fn();

    setupTauriMocks((cmd, args) => {
      if (cmd === "add_account") {
        addAccountCalls(args);
        return new Promise<unknown>((resolve) => {
          resolveAddAccount = resolve;
        });
      }
      return null;
    });

    const user = userEvent.setup();
    render(<AddAccountForm />, { wrapper: createWrapper() });

    await selectService(user, "Local Feeds");
    await user.type(screen.getByLabelText("Name"), "Work RSS");
    await user.keyboard("{Enter}");

    const addButton = screen.getByRole("button", { name: "Adding..." });
    expect(addAccountCalls).toHaveBeenCalledTimes(1);
    expect(addButton).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByLabelText("Name")).toBeDisabled();

    const resolve = resolveAddAccount as ((value: unknown) => void) | null;
    if (!resolve) {
      throw new Error("add_account did not start");
    }

    resolve({
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
});
