import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createWrapper } from "@tests/helpers/create-wrapper";
import { describe, expect, it, vi } from "vitest";
import { CredentialStorageSectionView } from "@/components/settings/credential-storage-section-view";

type ViewProps = Parameters<typeof CredentialStorageSectionView>[0];

const baseProps: ViewProps = {
  heading: "Credentials",
  label: "Credential storage",
  description: "Where credentials are stored. Switching migrates them.",
  osKeychainLabel: "OS keychain (recommended)",
  localFileLabel: "Local file",
  localFileWarning: "A local file is less secure than the OS keychain.",
  storage: "os_keychain",
  loaded: true,
  configurable: true,
  saving: false,
  onStorageChange: vi.fn(),
};

describe("CredentialStorageSectionView", () => {
  it("hides the local-file warning while the OS keychain is selected", () => {
    render(<CredentialStorageSectionView {...baseProps} />, { wrapper: createWrapper() });

    expect(screen.getByRole("heading", { name: "Credentials" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Credential storage" })).toHaveTextContent("OS keychain (recommended)");
    expect(screen.getByText("Where credentials are stored. Switching migrates them.")).toBeInTheDocument();
    expect(screen.queryByText("A local file is less secure than the OS keychain.")).not.toBeInTheDocument();
  });

  it("shows the local-file warning when a local file is the storage target", () => {
    render(<CredentialStorageSectionView {...baseProps} storage="local_file" />, { wrapper: createWrapper() });

    expect(screen.getByRole("combobox", { name: "Credential storage" })).toHaveTextContent("Local file");
    expect(screen.getByText("A local file is less secure than the OS keychain.")).toBeInTheDocument();
  });

  it("renders nothing while the backend value is not loaded", () => {
    const { container } = render(<CredentialStorageSectionView {...baseProps} loaded={false} />, {
      wrapper: createWrapper(),
    });

    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when credential storage is not configurable", () => {
    const { container } = render(<CredentialStorageSectionView {...baseProps} configurable={false} />, {
      wrapper: createWrapper(),
    });

    expect(container.firstChild).toBeNull();
  });

  it("selects local_file and reports the change through onStorageChange", async () => {
    const user = userEvent.setup();
    const onStorageChange = vi.fn();

    render(<CredentialStorageSectionView {...baseProps} onStorageChange={onStorageChange} />, {
      wrapper: createWrapper(),
    });

    await user.click(screen.getByRole("combobox", { name: "Credential storage" }));
    await user.click(await screen.findByRole("option", { name: "Local file" }));

    expect(onStorageChange).toHaveBeenCalledTimes(1);
    expect(onStorageChange).toHaveBeenCalledWith("local_file");
  });
});
