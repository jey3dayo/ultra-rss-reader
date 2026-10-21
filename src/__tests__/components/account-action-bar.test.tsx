import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AccountActionBar } from "@/components/settings/account-detail/account-action-bar";

type BarProps = Parameters<typeof AccountActionBar>[0];

function buildProps(overrides: Partial<BarProps> = {}): BarProps {
  return {
    hasUnsavedChanges: false,
    running: false,
    message: "You have unsaved changes",
    discardLabel: "Discard",
    saveAndTestLabel: "Save & Test Connection",
    testConnectionLabel: "Check Connection",
    testingLabel: "Checking…",
    connectionVerified: false,
    connectionVerifiedLabel: "Connection verified",
    onDiscard: vi.fn(),
    onTestConnection: vi.fn(),
    ...overrides,
  };
}

describe("AccountActionBar", () => {
  it("offers only the connection check when nothing is unsaved", async () => {
    const user = userEvent.setup();
    const props = buildProps();
    render(<AccountActionBar {...props} />);

    expect(screen.queryByText("You have unsaved changes")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Discard" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save & Test Connection" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Check Connection" }));

    expect(props.onTestConnection).toHaveBeenCalledOnce();
  });

  it("shows the unsaved message with discard and save-and-test when edits are pending", async () => {
    const user = userEvent.setup();
    const props = buildProps({ hasUnsavedChanges: true });
    render(<AccountActionBar {...props} />);

    expect(screen.getByRole("status")).toHaveTextContent("You have unsaved changes");
    expect(screen.queryByRole("button", { name: "Check Connection" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Discard" }));
    expect(props.onDiscard).toHaveBeenCalledOnce();
    expect(props.onTestConnection).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Save & Test Connection" }));
    expect(props.onTestConnection).toHaveBeenCalledOnce();
  });

  it("locks the check button while a clean-mode check is running", async () => {
    const user = userEvent.setup();
    const props = buildProps({ running: true });
    render(<AccountActionBar {...props} />);

    const button = screen.getByRole("button", { name: "Checking…" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");

    await user.click(button);
    expect(props.onTestConnection).not.toHaveBeenCalled();
  });

  it("locks both buttons while a save-and-test is running", async () => {
    const user = userEvent.setup();
    const props = buildProps({ hasUnsavedChanges: true, running: true });
    render(<AccountActionBar {...props} />);

    const discard = screen.getByRole("button", { name: "Discard" });
    const submit = screen.getByRole("button", { name: /Checking…/ });
    expect(discard).toBeDisabled();
    expect(submit).toBeDisabled();

    await user.click(discard);
    await user.click(submit);
    expect(props.onDiscard).not.toHaveBeenCalled();
    expect(props.onTestConnection).not.toHaveBeenCalled();
  });

  it("keeps the unsaved layout for the whole run when the save clears the dirty state", () => {
    const props = buildProps({ hasUnsavedChanges: true });
    const { rerender } = render(<AccountActionBar {...props} />);

    rerender(<AccountActionBar {...props} running />);
    rerender(<AccountActionBar {...props} hasUnsavedChanges={false} running />);

    expect(screen.getByRole("status")).toHaveTextContent("You have unsaved changes");
    expect(screen.getByRole("button", { name: "Discard" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Check Connection" })).not.toBeInTheDocument();

    rerender(<AccountActionBar {...props} hasUnsavedChanges={false} running={false} />);

    expect(screen.queryByText("You have unsaved changes")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Check Connection" })).toBeEnabled();
  });

  it("keeps the clean layout for the whole run when edits are typed during the check", () => {
    const props = buildProps();
    const { rerender } = render(<AccountActionBar {...props} />);

    rerender(<AccountActionBar {...props} running />);
    rerender(<AccountActionBar {...props} hasUnsavedChanges running />);

    expect(screen.queryByRole("button", { name: "Discard" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Checking…" })).toBeDisabled();
  });

  it("announces the verified result after a clean-mode check", () => {
    render(<AccountActionBar {...buildProps({ connectionVerified: true })} />);

    expect(screen.getByRole("button", { name: "Connection verified" })).toBeInTheDocument();
  });
});
