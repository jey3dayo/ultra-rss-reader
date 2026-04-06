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

    const button = screen.getByRole("button", { name: "Testing..." });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button.querySelector("[data-slot='loading-spinner']")).not.toBeNull();
  });
});
