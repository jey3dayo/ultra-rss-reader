import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { AccountCredentialsSectionView } from "@/components/settings/account-detail/credentials-section-view";

describe("AccountCredentialsSectionView", () => {
  it("keeps a password failure right under the password field with a retry action", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(
      <AccountCredentialsSectionView
        heading="Credentials"
        usernameLabel="Username"
        usernameValue="debug"
        onUsernameChange={() => {}}
        passwordLabel="Password"
        passwordValue="typed-draft"
        passwordPlaceholder="Enter password"
        passwordFailureNotice={{
          lines: ["Access to Keychain was canceled.", "Your changes are still in the form."],
          retryLabel: "Retry Save",
          onRetry,
          retryDisabled: false,
        }}
        onPasswordChange={() => {}}
      />,
    );

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Access to Keychain was canceled.");
    expect(screen.getByLabelText("Password").compareDocumentPosition(alert)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(screen.getByLabelText("Password")).toHaveValue("typed-draft");
    await user.click(screen.getByRole("button", { name: "Retry Save" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

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

  it("does not trigger persistence when blur callbacks are absent", async () => {
    const user = userEvent.setup();
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
      />,
    );

    const serverUrlInput = screen.getByRole("textbox", { name: "Server URL" });
    await user.type(serverUrlInput, "/changed");
    serverUrlInput.blur();

    expect(onServerUrlChange).toHaveBeenCalled();
  });

  it("highlights changed fields with an accent border and indicator dot", () => {
    render(
      <AccountCredentialsSectionView
        heading="Credentials"
        serverUrlLabel="Server URL"
        serverUrlValue="https://freshrss.example.com"
        onServerUrlChange={() => {}}
        usernameLabel="Username"
        usernameValue="debug"
        onUsernameChange={() => {}}
        passwordLabel="Password"
        passwordValue=""
        passwordPlaceholder="Enter password"
        onPasswordChange={() => {}}
        onPasswordBlur={() => {}}
        changedFields={{ serverUrl: true, username: false, password: false }}
        changedFieldLabel="Changed"
      />,
    );

    expect(screen.getByRole("textbox", { name: "Server URL" })).toHaveClass(
      "border-[var(--settings-field-changed-border)]",
    );
    expect(screen.getByRole("textbox", { name: "Username" })).not.toHaveClass(
      "border-[var(--settings-field-changed-border)]",
    );
    expect(screen.getByText("Changed")).toBeInTheDocument();
    expect(screen.getAllByText("Changed")).toHaveLength(1);
  });

  it("highlights the Cloudflare Access client ID input while leaving the secret input unchanged", () => {
    render(
      <AccountCredentialsSectionView
        heading="Server"
        usernameLabel="Username"
        usernameValue="alice"
        onUsernameChange={() => {}}
        passwordLabel="Password"
        passwordValue=""
        passwordPlaceholder="Enter new password"
        onPasswordChange={() => {}}
        cloudflareAccess={{
          status: "ready",
          hasSavedSecret: false,
          secretEditing: false,
          secretVisible: false,
          secretDescription: "Leave blank to keep the saved Secret.",
          secretSavedLabel: "Saved",
          secretChangeLabel: "Change",
          secretChangeAriaLabel: "Change saved Client Secret",
          secretCancelLabel: "Cancel",
          secretShowLabel: "Show new Secret",
          secretHideLabel: "Hide new Secret",
          onSecretEditingChange: () => {},
          onSecretVisibilityChange: () => {},
          loadingMessage: "Checking…",
          unavailableMessage: "Manage Access in the desktop app.",
          authorizationRequiredMessage: "Run the connection test to load Access settings.",
          label: "Cloudflare Access",
          description: "Add Access authentication",
          enabled: true,
          onEnabledChange: () => {},
          changedFieldLabel: "Changed",
          clientId: {
            label: "Client ID",
            value: "edited-client-id",
            onChange: () => {},
            changed: true,
          },
          clientSecret: {
            label: "Client Secret",
            value: "",
            placeholder: "New Client Secret",
            onChange: () => {},
            changed: false,
          },
          clientIdError: "Enter a Client ID",
          clientSecretError: "Enter a Client Secret",
          validationError: null,
        }}
      />,
    );

    const clientIdInput = screen.getByLabelText("Client ID");
    const secretInput = screen.getByLabelText("Client Secret");
    expect(clientIdInput).toHaveClass("border-[var(--settings-field-changed-border)]");
    expect(secretInput).not.toHaveClass("border-[var(--settings-field-changed-border)]");
    expect(screen.getAllByText("Changed")).toHaveLength(1);
  });

  it("does not render changed field indicators without changedFields", () => {
    render(
      <AccountCredentialsSectionView
        heading="Credentials"
        serverUrlLabel="Server URL"
        serverUrlValue="https://freshrss.example.com"
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

    expect(screen.queryByText("Changed")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Server URL" })).not.toHaveClass(
      "border-[var(--settings-field-changed-border)]",
    );
  });

  it("renders flexible credential inputs and no connection-test button, which lives in the pane action bar", () => {
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

    expect(screen.getByRole("textbox", { name: "Server URL" })).toHaveClass("w-full", "h-11");
    expect(screen.getByRole("textbox", { name: "Username" })).toHaveClass("w-full", "h-11");
    expect(screen.getByPlaceholderText("Enter password")).toHaveClass("w-full", "h-11");
    expect(screen.getAllByRole("button").map((button) => button.getAttribute("aria-label"))).toEqual([
      "Copy Server URL",
    ]);
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

    function ConfiguredAccessView() {
      const [secretEditing, setSecretEditing] = useState(false);
      const [secretVisible, setSecretVisible] = useState(false);
      const [secret, setSecret] = useState("");
      return (
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
            hasSavedSecret: true,
            secretEditing,
            secretVisible,
            secretDescription:
              "Leave blank to keep the saved Secret. Changing the Client ID or server origin requires a new Secret.",
            secretSavedLabel: "Saved",
            secretChangeLabel: "Change",
            secretChangeAriaLabel: "Change saved Client Secret",
            secretCancelLabel: "Cancel",
            secretShowLabel: "Show new Secret",
            secretHideLabel: "Hide new Secret",
            onSecretEditingChange: (editing) => {
              setSecretEditing(editing);
              if (!editing) {
                setSecret("");
                setSecretVisible(false);
              }
            },
            onSecretVisibilityChange: setSecretVisible,
            loadingMessage: "Checking…",
            unavailableMessage: "Manage Access in the desktop app.",
            authorizationRequiredMessage: "Run the connection test to load Access settings.",
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
              value: secret,
              placeholder: "New Client Secret",
              onChange: (value) => {
                onClientSecretChange(value);
                setSecret(value);
              },
              onBlur,
            },
            clientIdError: "Enter a Client ID",
            clientSecretError: "Enter a Client Secret",
            validationError: null,
          }}
        />
      );
    }

    render(<ConfiguredAccessView />);

    expect(screen.getByRole("switch", { name: "Cloudflare Access" })).toBeChecked();
    expect(screen.getByLabelText("Client ID")).toHaveValue("saved-client-id");
    expect(screen.getByText("Saved")).toBeVisible();
    expect(screen.queryByLabelText("Client Secret")).not.toBeInTheDocument();
    expect(screen.getByText("••••••••")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Change saved Client Secret" }));
    const secretInput = screen.getByLabelText("Client Secret");
    expect(secretInput).toHaveValue("");
    expect(secretInput).toHaveAttribute("type", "password");
    expect(secretInput).toHaveFocus();
    const descriptionId = secretInput.getAttribute("aria-describedby");
    expect(descriptionId).not.toBeNull();
    if (descriptionId) {
      expect(document.getElementById(descriptionId)).toHaveTextContent("Leave blank to keep the saved Secret");
    }
    await user.click(screen.getByRole("button", { name: "Show new Secret" }));
    expect(secretInput).toHaveAttribute("type", "text");
    expect(secretInput).toHaveValue("");
    await user.type(secretInput, "new-dummy-secret");
    expect(secretInput).toHaveValue("new-dummy-secret");
    await user.click(screen.getByRole("button", { name: "Hide new Secret" }));
    expect(secretInput).toHaveAttribute("type", "password");
    expect(secretInput).toHaveValue("new-dummy-secret");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByLabelText("Client Secret")).not.toBeInTheDocument();
    expect(screen.getByText("••••••••")).toBeVisible();
    expect(screen.getByRole("button", { name: "Change saved Client Secret" })).toHaveFocus();
    onBlur.mockClear();
    onClientSecretChange.mockClear();
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

  it("says saved Access credentials will be removed once the switch is turned off", () => {
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
          hasSavedSecret: true,
          secretEditing: false,
          secretVisible: false,
          secretDescription: "",
          secretSavedLabel: "Saved",
          secretChangeLabel: "Change",
          secretChangeAriaLabel: "Change saved Client Secret",
          secretCancelLabel: "Cancel",
          secretShowLabel: "Show new Secret",
          secretHideLabel: "Hide new Secret",
          onSecretEditingChange: () => {},
          onSecretVisibilityChange: () => {},
          loadingMessage: "Checking…",
          unavailableMessage: "Manage Access in the desktop app.",
          authorizationRequiredMessage: "Run the connection test to load Access settings.",
          label: "Cloudflare Access",
          description: "Add Access authentication",
          enabled: false,
          onEnabledChange: () => {},
          clientId: { label: "Client ID", value: "saved-client-id", onChange: () => {}, onBlur: () => {} },
          clientSecret: { label: "Client Secret", value: "", onChange: () => {}, onBlur: () => {} },
          clientIdError: "Enter a Client ID",
          clientSecretError: "Enter a Client Secret",
          validationError: null,
        }}
      />,
    );

    expect(screen.getByRole("switch", { name: "Cloudflare Access" })).not.toBeChecked();
    expect(screen.getByText("Saved Access credentials will be removed when you save.")).toBeVisible();
  });

  it("keeps a required Secret draft cancelable and focuses its empty field after cancel", async () => {
    const user = userEvent.setup();

    function RequiredSecretView() {
      const [secretEditing, setSecretEditing] = useState(false);
      const [secretVisible, setSecretVisible] = useState(false);
      const [secret, setSecret] = useState("");
      const [clientId, setClientId] = useState("saved-client-id");
      const validationError = clientId !== "saved-client-id" && secret.length === 0 ? "client_secret_required" : null;

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
            status: "ready",
            hasSavedSecret: true,
            secretEditing,
            secretVisible,
            secretDescription: "Leave blank to keep the saved Secret.",
            secretSavedLabel: "Saved",
            secretChangeLabel: "Change",
            secretChangeAriaLabel: "Change saved Client Secret",
            secretCancelLabel: "Cancel",
            secretShowLabel: "Show new Secret",
            secretHideLabel: "Hide new Secret",
            onSecretEditingChange: (editing) => {
              setSecretEditing(editing);
              if (!editing) {
                setSecret("");
                setSecretVisible(false);
              }
            },
            onSecretVisibilityChange: setSecretVisible,
            loadingMessage: "Checking…",
            unavailableMessage: "Manage Access in the desktop app.",
            authorizationRequiredMessage: "Run the connection test to load Access settings.",
            label: "Cloudflare Access",
            description: "Add Access authentication",
            enabled: true,
            onEnabledChange: () => {},
            clientId: {
              label: "Client ID",
              value: clientId,
              onChange: setClientId,
            },
            clientSecret: {
              label: "Client Secret",
              value: secret,
              placeholder: "New Client Secret",
              onChange: setSecret,
            },
            clientIdError: "Enter a Client ID",
            clientSecretError: "Enter a Client Secret",
            validationError,
          }}
        />
      );
    }

    render(<RequiredSecretView />);

    await user.click(screen.getByRole("button", { name: "Change saved Client Secret" }));
    await user.type(screen.getByLabelText("Client Secret"), "new-dummy-secret");
    await user.clear(screen.getByLabelText("Client ID"));
    await user.type(screen.getByLabelText("Client ID"), "changed-client-id");
    expect(screen.queryByText("Enter a Client Secret")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    const secretInput = screen.getByLabelText("Client Secret");
    expect(screen.getByLabelText("Client ID")).toHaveValue("changed-client-id");
    expect(secretInput).toHaveValue("");
    expect(secretInput).toHaveAttribute("type", "password");
    expect(screen.getByText("Enter a Client Secret")).toBeVisible();
    expect(screen.queryByText("••••••••")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Change saved Client Secret" })).not.toBeInTheDocument();
    expect(secretInput).toHaveFocus();
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
            hasSavedSecret: false,
            secretEditing: false,
            secretVisible: false,
            secretDescription: "Leave blank to keep the saved Secret.",
            secretSavedLabel: "Saved",
            secretChangeLabel: "Change",
            secretChangeAriaLabel: "Change saved Client Secret",
            secretCancelLabel: "Cancel",
            secretShowLabel: "Show new Secret",
            secretHideLabel: "Hide new Secret",
            onSecretEditingChange: () => {},
            onSecretVisibilityChange: () => {},
            recoveryAction: action,
            onRecoveryActionChange: (nextAction) => {
              recovery(nextAction);
              setAction(nextAction);
            },
            loadingMessage: "Checking…",
            failureNotice: {
              lines: ["Cloudflare Access settings could not be read. Existing credentials will be kept unchanged."],
              retryLabel: "Try Again",
              onRetry: () => {},
              retryDisabled: false,
            },
            unavailableMessage: "Manage Access in the desktop app.",
            authorizationRequiredMessage: "Run the connection test to load Access settings.",
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

  it("keeps the Access row with recovery actions in place of the switch while authorization is required", async () => {
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
            hasSavedSecret: false,
            secretEditing: false,
            secretVisible: false,
            secretDescription: "Leave blank to keep the saved Secret.",
            secretSavedLabel: "Saved",
            secretChangeLabel: "Change",
            secretChangeAriaLabel: "Change saved Client Secret",
            secretCancelLabel: "Cancel",
            secretShowLabel: "Show new Secret",
            secretHideLabel: "Hide new Secret",
            onSecretEditingChange: () => {},
            onSecretVisibilityChange: () => {},
            recoveryAction: action,
            onRecoveryActionChange: (nextAction) => {
              recovery(nextAction);
              setAction(nextAction);
            },
            loadingMessage: "Checking…",
            unavailableMessage: "Manage Access in the desktop app.",
            authorizationRequiredMessage: "Run the connection test to load Access settings.",
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

    expect(screen.getByText("Cloudflare Access")).toBeVisible();
    expect(screen.getByText("Add Access authentication")).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("Run the connection test to load Access settings.");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
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
