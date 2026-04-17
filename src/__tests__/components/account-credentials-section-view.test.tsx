import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AccountCredentialsSectionView } from "@/components/settings/account-credentials-section-view";

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

  it("shows a loading button while testing the connection", () => {
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
    expect(screen.getByRole("textbox", { name: "Server URL" })).toHaveClass("sm:flex-1");
    expect(screen.getByRole("textbox", { name: "Username" })).toHaveClass("w-full");
    expect(screen.getByPlaceholderText("Enter password")).toHaveClass("w-full");
    expect(screen.getByRole("button", { name: "Copy Server URL" })).toBeInTheDocument();
    const button = screen.getByRole("button", { name: "Testing..." });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toHaveClass("w-full");
    expect(button).toHaveClass("sm:w-auto");
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

    expect(screen.getByText("Server URL")).toHaveClass("sm:w-24");
    expect(screen.getByText("Username")).toHaveClass("sm:w-24");
    expect(screen.getByText("Username")).toHaveClass("sm:shrink-0");
    expect(screen.getByRole("textbox", { name: "Server URL" })).toHaveClass("sm:flex-1");
    expect(screen.getByRole("textbox", { name: "Username" })).toHaveClass("sm:flex-1");
    expect(screen.getByPlaceholderText("Enter password")).toHaveClass("sm:flex-1");
  });

  it("renders extra rows and a note for shared app credentials", () => {
    render(
      <AccountCredentialsSectionView
        heading="Credentials"
        note="Applies to all Inoreader accounts."
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

    expect(screen.getByText("Applies to all Inoreader accounts.")).toBeInTheDocument();
    expect(screen.getByDisplayValue("shared-id")).toBeInTheDocument();
    expect(screen.getByDisplayValue("shared-key")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Email" })).toBeInTheDocument();
  });
});
