import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, expectTypeOf, it, vi } from "vitest";
import { AccountConfigFormView } from "@/components/settings/add-account/account-config-form-view";
import {
  type AddAccountCredentialsSection,
  AddAccountFormView,
  type AddAccountInputControl,
} from "@/components/settings/add-account/form-view";

describe("AddAccountFormView", () => {
  it("keeps shared add-account form controls in the form view type surface", () => {
    expectTypeOf<AddAccountInputControl>().toHaveProperty("value").toEqualTypeOf<string>();
    expectTypeOf<AddAccountInputControl>().toHaveProperty("onChange").toEqualTypeOf<(value: string) => void>();
    expectTypeOf<AddAccountCredentialsSection>()
      .toHaveProperty("serverUrl")
      .toEqualTypeOf<AddAccountInputControl | undefined>();
    expectTypeOf<AddAccountCredentialsSection>().toHaveProperty("credential").toEqualTypeOf<AddAccountInputControl>();
    expectTypeOf<AddAccountCredentialsSection>().toHaveProperty("password").toEqualTypeOf<AddAccountInputControl>();
  });

  it("renders credential fields only when a credentials section is provided", () => {
    const { container, rerender } = render(
      <AddAccountFormView
        title="Add Account"
        accountHeading="Account"
        accountType={{
          label: "Type",
          name: "account-type",
          value: "Local",
          options: [
            { value: "Local", label: "Local" },
            { value: "FreshRss", label: "FreshRSS" },
          ],
          onChange: () => {},
          disabled: false,
        }}
        accountName={{
          label: "Name",
          name: "account-name",
          value: "Local",
          placeholder: "Local",
          onChange: () => {},
          disabled: false,
        }}
        submitLabel="Add"
        submittingLabel="Adding…"
        cancelLabel="Cancel"
        submitting={false}
        onSubmit={() => {}}
        onCancel={() => {}}
      />,
    );

    expect(screen.queryByLabelText("Server URL")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Username")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
    expect(container.querySelectorAll('[data-surface-card="section"]')).toHaveLength(1);

    rerender(
      <AddAccountFormView
        title="Add Account"
        accountHeading="Account"
        accountType={{
          label: "Type",
          name: "account-type",
          value: "FreshRss",
          options: [
            { value: "Local", label: "Local" },
            { value: "FreshRss", label: "FreshRSS" },
          ],
          onChange: () => {},
          disabled: false,
        }}
        accountName={{
          label: "Name",
          name: "account-name",
          value: "Work RSS",
          placeholder: "FreshRss",
          onChange: () => {},
          disabled: false,
        }}
        credentialsSection={{
          heading: "FreshRSS",
          serverUrl: {
            label: "Server URL",
            name: "server-url",
            value: "https://example.com",
            placeholder: "https://your-freshrss.com",
            onChange: () => {},
            disabled: false,
          },
          credential: {
            label: "Username",
            name: "username",
            value: "alice",
            onChange: () => {},
            disabled: false,
          },
          password: {
            label: "Password",
            name: "password",
            value: "secret",
            type: "password",
            onChange: () => {},
            disabled: false,
          },
        }}
        submitLabel="Add"
        submittingLabel="Adding…"
        cancelLabel="Cancel"
        submitting={false}
        onSubmit={() => {}}
        onCancel={() => {}}
      />,
    );

    expect(screen.getByRole("heading", { level: 2, name: "Add Account" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Type" })).toHaveTextContent("FreshRSS");
    expect(screen.getByLabelText("Server URL")).toHaveValue("https://example.com");
    expect(screen.getByLabelText("Name")).toHaveClass("w-full");
    expect(screen.getByLabelText("Server URL")).toHaveClass("w-full");
    expect(screen.getByLabelText("Username")).toHaveClass("w-full");
    expect(screen.getByLabelText("Password")).toHaveClass("w-full");
    expect(screen.getByLabelText("Server URL")).toHaveClass("h-10");
    expect(screen.getByLabelText("Username")).toHaveClass("h-10");
    expect(screen.getByLabelText("Password")).toHaveClass("h-10");
    expect(screen.getByText("Server URL")).toHaveClass("sm:w-40");
    expect(screen.getByLabelText("Username")).toHaveValue("alice");
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
    expect(container.querySelectorAll('[data-surface-card="section"]')).toHaveLength(2);
  });

  it("delegates field changes and form actions", async () => {
    const user = userEvent.setup();
    const onTypeChange = vi.fn();
    const onNameChange = vi.fn();
    const onSubmit = vi.fn();
    const onCancel = vi.fn();

    render(
      <AddAccountFormView
        title="Add Account"
        accountHeading="Account"
        accountType={{
          label: "Type",
          name: "account-type",
          value: "Local",
          options: [
            { value: "Local", label: "Local" },
            { value: "FreshRss", label: "FreshRSS" },
          ],
          onChange: onTypeChange,
          disabled: false,
        }}
        accountName={{
          label: "Name",
          name: "account-name",
          value: "",
          placeholder: "Local",
          onChange: onNameChange,
          disabled: false,
        }}
        errorMessage="Server URL is required"
        submitLabel="Add"
        submittingLabel="Adding…"
        cancelLabel="Cancel"
        submitting={false}
        onSubmit={onSubmit}
        onCancel={onCancel}
      />,
    );

    await user.click(screen.getByRole("combobox", { name: "Type" }));
    await user.click(await screen.findByRole("option", { name: "FreshRSS" }));
    await user.type(screen.getByLabelText("Name"), "Work RSS");
    await user.click(screen.getByRole("button", { name: "Add" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onTypeChange).toHaveBeenCalledWith("FreshRss");
    expect(onNameChange).toHaveBeenCalledWith("W");
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Server URL is required").parentElement).toHaveClass(
      "border-state-danger-border",
      "bg-state-danger-surface",
    );
  });

  it("uses native form submit semantics without browser navigation", () => {
    const onSubmit = vi.fn();
    const { container } = render(
      <AddAccountFormView
        title="Add Account"
        accountHeading="Account"
        accountType={{
          label: "Type",
          name: "account-type",
          value: "Local",
          options: [{ value: "Local", label: "Local" }],
          onChange: () => {},
          disabled: false,
        }}
        accountName={{
          label: "Name",
          name: "account-name",
          value: "Local",
          placeholder: "Local",
          onChange: () => {},
          disabled: false,
        }}
        submitLabel="Add"
        submittingLabel="Adding…"
        cancelLabel="Cancel"
        submitting={false}
        onSubmit={onSubmit}
        onCancel={() => {}}
      />,
    );

    const form = container.querySelector("form");
    expect(form).not.toBeNull();

    const submitEvent = new Event("submit", { bubbles: true, cancelable: true });
    const dispatchResult = form?.dispatchEvent(submitEvent);

    expect(dispatchResult).toBe(false);
    expect(submitEvent.defaultPrevented).toBe(true);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});

describe("AccountConfigFormView", () => {
  it("uses native form submit semantics without browser navigation", () => {
    const onSubmit = vi.fn();
    const { container } = render(
      <AccountConfigFormView
        title="Configure Account"
        backLabel="Back"
        backAriaLabel="Back to services"
        accountHeading="Account"
        accountName={{
          label: "Name",
          name: "account-name",
          value: "Work RSS",
          placeholder: "FreshRSS",
          onChange: () => {},
          disabled: false,
        }}
        credentialsSection={{
          heading: "FreshRSS",
          serverUrl: {
            label: "Server URL",
            name: "server-url",
            value: "https://example.com",
            placeholder: "https://your-freshrss.com",
            onChange: () => {},
            disabled: false,
          },
          credential: {
            label: "Username",
            name: "username",
            value: "alice",
            onChange: () => {},
            disabled: false,
          },
          password: {
            label: "Password",
            name: "password",
            value: "secret",
            type: "password",
            onChange: () => {},
            disabled: false,
          },
        }}
        submitLabel="Add"
        submittingLabel="Adding…"
        cancelLabel="Cancel"
        submitting={false}
        onBack={() => {}}
        onSubmit={onSubmit}
        onCancel={() => {}}
      />,
    );

    const form = container.querySelector("form");
    expect(form).not.toBeNull();

    const submitEvent = new Event("submit", { bubbles: true, cancelable: true });
    const dispatchResult = form?.dispatchEvent(submitEvent);

    expect(dispatchResult).toBe(false);
    expect(submitEvent.defaultPrevented).toBe(true);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
