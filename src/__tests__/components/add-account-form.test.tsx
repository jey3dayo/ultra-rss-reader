import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { AddAccountForm } from "@/components/settings/add-account-form";
import { useUiStore } from "@/stores/ui-store";
import { createWrapper } from "../../../tests/helpers/create-wrapper";
import { setupTauriMocks } from "../../../tests/helpers/tauri-mocks";

async function selectAccountType(user: ReturnType<typeof userEvent.setup>, optionName: string) {
  await user.click(screen.getByRole("combobox"));
  await user.click(await screen.findByRole("option", { name: optionName }));
}

describe("AddAccountForm", () => {
  beforeEach(() => {
    useUiStore.setState(useUiStore.getInitialState());
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

    await selectAccountType(user, "FreshRSS");
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => {
      expect(useUiStore.getState().toastMessage).toEqual({ message: "Server URL is required" });
    });
    expect(addAccountCalls).toBe(0);
  });

  it("preserves entered values when switching providers", async () => {
    const user = userEvent.setup();
    const { container } = render(<AddAccountForm />, { wrapper: createWrapper() });

    await selectAccountType(user, "FreshRSS");
    await user.type(screen.getByPlaceholderText("FreshRss"), "Work RSS");
    await user.type(screen.getByPlaceholderText("https://your-freshrss.com"), "https://example.com");

    const usernameInput = container.querySelector<HTMLInputElement>('input[name="username"]');
    const passwordInput = container.querySelector<HTMLInputElement>('input[name="password"]');

    if (!usernameInput || !passwordInput) {
      throw new Error("credentials inputs were not rendered");
    }

    await user.type(usernameInput, "alice");
    await user.type(passwordInput, "secret");

    await selectAccountType(user, "Inoreader");

    expect(screen.getByDisplayValue("Work RSS")).toBeInTheDocument();
    expect(container.querySelector('input[name="email"]')).toHaveValue("alice");
    expect(container.querySelector('input[name="password"]')).toHaveValue("secret");

    await selectAccountType(user, "FreshRSS");

    expect(screen.getByDisplayValue("Work RSS")).toBeInTheDocument();
    expect(screen.getByDisplayValue("https://example.com")).toBeInTheDocument();
    expect(container.querySelector('input[name="username"]')).toHaveValue("alice");
    expect(container.querySelector('input[name="password"]')).toHaveValue("secret");
  });
});
