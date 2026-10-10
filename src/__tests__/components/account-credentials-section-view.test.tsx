import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { AccountCredentialsSectionView } from "@/components/settings/account-detail/credentials-section-view";

function expectStandaloneSettingsActionButton(button: HTMLElement) {
  expect(button).toHaveClass("h-9", "min-h-9", "px-3");
  expect(button).toHaveClass("text-[13px]", "font-medium");
  expect(button).not.toHaveClass("h-11", "px-4");
}

describe("AccountCredentialsSectionView", () => {
  it("renders credential inputs and delegates changes", async () => {
    const user = userEvent.setup();
    const onUsernameChange = vi.fn();
    const onUsernameBlur = vi.fn();
    const onPasswordChange = vi.fn();
    const onPasswordBlur = vi.fn();

    render(
      <AccountCredentialsSectionView
        heading="Credentials"
        usernameLabel="Username"
        usernameValue="debug"
        onUsernameChange={onUsernameChange}
        onUsernameBlur={onUsernameBlur}
        passwordLabel="Password"
        passwordValue=""
        passwordPlaceholder="Enter password"
        onPasswordChange={onPasswordChange}
        onPasswordBlur={onPasswordBlur}
      />,
    );

    const usernameInput = screen.getByDisplayValue("debug");
    const passwordInput = screen.getByPlaceholderText("Enter password");

    await user.clear(usernameInput);
    await user.type(usernameInput, "reader");
    usernameInput.blur();

    await user.type(passwordInput, "secret");
    passwordInput.blur();

    expect(onUsernameChange).toHaveBeenCalled();
    expect(onUsernameBlur).toHaveBeenCalled();
    expect(onPasswordChange).toHaveBeenCalled();
    expect(onPasswordBlur).toHaveBeenCalled();
  });

  it("does not trigger persistence or connection verification when blur callbacks are absent", async () => {
    const user = userEvent.setup();
    const onTestConnection = vi.fn();
    const onServerUrlChange = vi.fn();

    render(
      <AccountCredentialsSectionView
        heading="Credentials"
        serverUrlLabel="Server URL"
        serverUrlValue="https://reader.example.com"
        onServerUrlChange={onServerUrlChange}
        usernameLabel="Username"
        usernameValue="alice"
        onUsernameChange={() => {}}
        passwordLabel="Password"
        passwordValue=""
        passwordPlaceholder="Enter password"
        onPasswordChange={() => {}}
        onTestConnection={onTestConnection}
      />,
    );

    const serverUrlInput = screen.getByRole("textbox", { name: "Server URL" });
    await user.type(serverUrlInput, "/changed");
    serverUrlInput.blur();

    expect(onServerUrlChange).toHaveBeenCalled();
    expect(onTestConnection).not.toHaveBeenCalled();
  });

  it("shows a settings-toned loading action while testing the connection", () => {
    render(
      <AccountCredentialsSectionView
        heading="Credentials"
        serverUrlLabel="Server URL"
        serverUrlValue="https://freshrss.example.com"
        serverUrlPlaceholder="https://freshrss.example.com"
        onServerUrlChange={() => {}}
        onServerUrlBlur={() => {}}
        serverUrlCopyLabel="Copy Server URL"
        onServerUrlCopy={() => {}}
        usernameLabel="Username"
        usernameValue="debug"
        onUsernameChange={() => {}}
        onUsernameBlur={() => {}}
        passwordLabel="Password"
        passwordValue=""
        passwordPlaceholder="Enter password"
        onPasswordChange={() => {}}
        onPasswordBlur={() => {}}
        testConnectionLabel="Test Connection"
        testingConnectionLabel="Testing..."
        onTestConnection={() => {}}
        isTestingConnection={true}
      />,
    );

    expect(screen.getByRole("textbox", { name: "Server URL" })).toHaveClass("w-full");
    expect(screen.getByRole("textbox", { name: "Server URL" })).toHaveClass("h-11");
    expect(screen.getByRole("textbox", { name: "Username" })).toHaveClass("w-full");
    expect(screen.getByRole("textbox", { name: "Username" })).toHaveClass("h-11");
    expect(screen.getByPlaceholderText("Enter password")).toHaveClass("w-full");
    expect(screen.getByPlaceholderText("Enter password")).toHaveClass("h-11");
    expect(screen.getByRole("button", { name: "Copy Server URL" })).toBeInTheDocument();
    const button = screen.getByRole("button", { name: "Testing..." });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expectStandaloneSettingsActionButton(button);
    expect(button).toHaveClass(
      "border",
      "border-[var(--settings-shell-control-border)]",
      "shadow-[var(--settings-shell-control-shadow)]",
      "bg-surface-2/82",
      "text-foreground",
    );
    expect(screen.getByText("Test Connection")).toHaveClass("sm:w-40");
    expect(button.querySelector("[data-slot='loading-spinner']")).not.toBeNull();
  });

  it("uses a fixed desktop label column and flexible credential inputs", () => {
    render(
      <AccountCredentialsSectionView
        heading="Credentials"
        serverUrlLabel="Server URL"
        serverUrlValue="https://freshrss.example.com"
        serverUrlPlaceholder="https://freshrss.example.com"
        onServerUrlChange={() => {}}
        onServerUrlBlur={() => {}}
        serverUrlCopyLabel="Copy Server URL"
        onServerUrlCopy={() => {}}
        usernameLabel="Username"
        usernameValue="debug"
        onUsernameChange={() => {}}
        onUsernameBlur={() => {}}
        passwordLabel="Password"
        passwordValue=""
        passwordPlaceholder="Enter password"
        onPasswordChange={() => {}}
        onPasswordBlur={() => {}}
      />,
    );

    expect(screen.getByText("Server URL")).toHaveClass("sm:w-40");
    expect(screen.getByText("Username")).toHaveClass("sm:w-40");
    expect(screen.getByText("Username")).toHaveClass("sm:shrink-0");
    expect(screen.getByRole("textbox", { name: "Server URL" })).toHaveClass("h-11");
    expect(screen.getByRole("textbox", { name: "Username" })).toHaveClass("h-11");
    expect(screen.getByPlaceholderText("Enter password")).toHaveClass("h-11");
  });

  it("renders extra rows and a note for shared app credentials", () => {
    render(
      <AccountCredentialsSectionView
        heading="Credentials"
        note="Shared credentials note."
        extraRows={[
          {
            label: "App ID",
            value: "shared-id",
            onChange: () => {},
            onBlur: () => {},
          },
          {
            label: "App Key",
            value: "shared-key",
            type: "password",
            onChange: () => {},
            onBlur: () => {},
          },
        ]}
        usernameLabel="Email"
        usernameValue="debug@example.com"
        onUsernameChange={() => {}}
        onUsernameBlur={() => {}}
        passwordLabel="Password"
        passwordValue=""
        passwordPlaceholder="Enter password"
        onPasswordChange={() => {}}
        onPasswordBlur={() => {}}
      />,
    );

    expect(screen.getByText("Shared credentials note.")).toBeInTheDocument();
    expect(screen.getByDisplayValue("shared-id")).toBeInTheDocument();
    expect(screen.getByDisplayValue("shared-key")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Email" })).toBeInTheDocument();
  });

  it("shows configured Access metadata without reading a Secret back", async () => {
    const user = userEvent.setup();
    const onEnabledChange = vi.fn();
    const onClientIdChange = vi.fn();
    const onClientSecretChange = vi.fn();
    const onBlur = vi.fn();

    render(
      <AccountCredentialsSectionView
        heading="Server"
        usernameLabel="Username"
        usernameValue="alice"
        onUsernameChange={() => {}}
        onUsernameBlur={() => {}}
        passwordLabel="Password"
        passwordValue="••••••••"
        passwordPlaceholder="Enter new password"
        onPasswordChange={() => {}}
        onPasswordBlur={() => {}}
        cloudflareAccess={{
          status: "ready",
          loadingMessage: "Checking…",
          readErrorMessage: "Access metadata could not be read. Existing credentials will be kept unchanged.",
          unavailableMessage: "Manage Access in the desktop app.",
          authorizationRequiredMessage: "Use Save and test connection to load Access settings.",
          label: "Cloudflare Access",
          description: "Add Access authentication",
          enabled: true,
          onEnabledChange,
          clientId: {
            label: "Client ID",
            value: "saved-client-id",
            onChange: onClientIdChange,
            onBlur,
          },
          clientSecret: {
            label: "Client Secret",
            value: "",
            placeholder: "Leave blank to keep the saved Secret",
            onChange: onClientSecretChange,
            onBlur,
          },
          clientIdError: "Enter a Client ID",
          clientSecretError: "Enter a Client Secret",
          validationError: null,
        }}
      />,
    );

    expect(screen.getByRole("switch", { name: "Cloudflare Access" })).toBeChecked();
    expect(screen.getByLabelText("Client ID")).toHaveValue("saved-client-id");
    expect(screen.getByLabelText("Client Secret")).toHaveValue("");
    const info = screen.getByRole("button", { name: "About Cloudflare Access" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Cloudflare Access" })).not.toBeInTheDocument());
    await user.click(info);
    expect(screen.getByRole("dialog", { name: "Cloudflare Access" })).toHaveTextContent(
      "Changing the Client ID or server origin requires a new Secret",
    );
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Cloudflare Access" })).not.toBeInTheDocument());
    expect(onBlur).not.toHaveBeenCalled();
    await user.clear(screen.getByLabelText("Client ID"));
    await user.type(screen.getByLabelText("Client ID"), "new-client-id");
    expect(onClientIdChange).toHaveBeenCalled();
    expect(onClientSecretChange).not.toHaveBeenCalled();
    expect(onBlur).not.toHaveBeenCalled();
    await user.click(screen.getByRole("switch", { name: "Cloudflare Access" }));
    expect(onEnabledChange).toHaveBeenCalledWith(false);
  });

  it("offers explicit recovery while keeping metadata unknown and hiding the saved-state switch", async () => {
    const user = userEvent.setup();
    const recovery = vi.fn();
    function RecoveryView() {
      const [action, setAction] = useState<"replace" | "remove" | null>(null);
      return (
        <AccountCredentialsSectionView
          heading="Server"
          usernameLabel="Username"
          usernameValue="alice"
          onUsernameChange={() => {}}
          onUsernameBlur={() => {}}
          passwordLabel="Password"
          passwordValue=""
          passwordPlaceholder="Enter new password"
          onPasswordChange={() => {}}
          onPasswordBlur={() => {}}
          cloudflareAccess={{
            status: "error",
            recoveryAction: action,
            onRecoveryActionChange: (nextAction) => {
              recovery(nextAction);
              setAction(nextAction);
            },
            loadingMessage: "Checking…",
            readErrorMessage:
              "Cloudflare Access settings could not be read. Existing credentials will be kept unchanged.",
            unavailableMessage: "Manage Access in the desktop app.",
            authorizationRequiredMessage: "Use Save and test connection to load Access settings.",
            label: "Cloudflare Access",
            description: "Add Access authentication",
            enabled: false,
            onEnabledChange: () => {},
            clientId: { label: "Client ID", value: "", onChange: () => {}, onBlur: () => {} },
            clientSecret: { label: "Client Secret", value: "", onChange: () => {}, onBlur: () => {} },
            clientIdError: "Enter a Client ID",
            clientSecretError: "Enter a Client Secret",
            validationError: null,
          }}
        />
      );
    }
    render(<RecoveryView />);

    expect(screen.getByRole("alert")).toHaveTextContent("Existing credentials will be kept unchanged");
    expect(screen.queryByRole("switch", { name: "Cloudflare Access" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Client ID")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reconfigure Access" }));
    expect(recovery).toHaveBeenLastCalledWith("replace");
    expect(screen.getByLabelText("Client ID")).toHaveValue("");
    expect(screen.getByLabelText("Client Secret")).toHaveValue("");
    expect(screen.getByRole("alert")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Remove Access" }));
    expect(recovery).toHaveBeenLastCalledWith("remove");
    expect(screen.queryByLabelText("Client ID")).not.toBeInTheDocument();
    expect(screen.getByText("Saved Access credentials will be removed when you save.")).toBeVisible();
    expect(screen.getByRole("alert")).toBeVisible();
  });

  it("keeps neutral guidance and offers explicit replace and remove while authorization is required", async () => {
    const user = userEvent.setup();
    const recovery = vi.fn();
    function AuthorizationRequiredView() {
      const [action, setAction] = useState<"replace" | "remove" | null>(null);
      return (
        <AccountCredentialsSectionView
          heading="Server"
          usernameLabel="Username"
          usernameValue="alice"
          onUsernameChange={() => {}}
          onUsernameBlur={() => {}}
          passwordLabel="Password"
          passwordValue=""
          passwordPlaceholder="Enter new password"
          onPasswordChange={() => {}}
          onPasswordBlur={() => {}}
          cloudflareAccess={{
            status: "authorization_required",
            recoveryAction: action,
            onRecoveryActionChange: (nextAction) => {
              recovery(nextAction);
              setAction(nextAction);
            },
            loadingMessage: "Checking…",
            readErrorMessage: "Access metadata could not be read.",
            unavailableMessage: "Manage Access in the desktop app.",
            authorizationRequiredMessage: "Use Save and test connection to load Access settings.",
            label: "Cloudflare Access",
            description: "Add Access authentication",
            enabled: false,
            onEnabledChange: () => {},
            clientId: { label: "Client ID", value: "", onChange: () => {}, onBlur: () => {} },
            clientSecret: { label: "Client Secret", value: "", onChange: () => {}, onBlur: () => {} },
            clientIdError: "Enter a Client ID",
            clientSecretError: "Enter a Client Secret",
            validationError: null,
          }}
        />
      );
    }
    render(<AuthorizationRequiredView />);

    expect(screen.getByRole("status")).toHaveTextContent("Use Save and test connection to load Access settings.");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("switch", { name: "Cloudflare Access" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Client ID")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reconfigure Access" }));
    expect(recovery).toHaveBeenLastCalledWith("replace");
    expect(screen.getByLabelText("Client ID")).toBeVisible();
    expect(screen.getByLabelText("Client Secret")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Remove Access" }));
    expect(recovery).toHaveBeenLastCalledWith("remove");
    expect(screen.getByText("Saved Access credentials will be removed when you save.")).toBeVisible();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
