import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { FormEvent } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CloudflareAccessControl } from "@/components/settings/shared/cloudflare-access-control";
import type { CredentialStoreKind } from "@/lib/account/credential-failure";

const { storeKind } = vi.hoisted(() => ({ storeKind: { current: "os_store" as CredentialStoreKind } }));

vi.mock("@/components/settings/hooks/use-credential-store-kind", () => ({
  useCredentialStoreKind: () => storeKind.current,
}));

describe("CloudflareAccessControl", () => {
  beforeEach(() => {
    storeKind.current = "os_store";
  });

  it.each([
    { kind: "keychain", included: "Keychain", excluded: "Windows Credential Manager" },
    { kind: "credential_manager", included: "Windows Credential Manager", excluded: "Keychain" },
    { kind: "local_file", included: "local file", excluded: "Keychain" },
  ] as const)("explains only the $kind store in the help popover", async ({ kind, included, excluded }) => {
    storeKind.current = kind;
    const user = userEvent.setup();
    render(
      <CloudflareAccessControl
        mode="detail"
        label="Cloudflare Access"
        description="Add Access authentication"
        checked={false}
        onChange={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "About Cloudflare Access" }));

    const popup = screen.getByRole("dialog", { name: "Cloudflare Access" });
    expect(popup).toHaveTextContent(included);
    expect(popup).not.toHaveTextContent(excluded);
  });

  it.each(["add", "detail"] as const)(
    "opens and closes %s help with pointer, keyboard, touch, and Escape without submitting",
    async (mode) => {
      const user = userEvent.setup();
      const submit = vi.fn((event: FormEvent<HTMLFormElement>) => event.preventDefault());
      const onChange = vi.fn();
      render(
        <form onSubmit={submit}>
          <CloudflareAccessControl
            mode={mode}
            label="Cloudflare Access"
            description="Add Access authentication"
            checked={false}
            onChange={onChange}
          />
        </form>,
      );
      const info = screen.getByRole("button", { name: "About Cloudflare Access" });
      const toggle = screen.getByRole("switch", { name: "Cloudflare Access" });
      await waitFor(() => expect(screen.queryByRole("dialog", { name: "Cloudflare Access" })).not.toBeInTheDocument());
      expect(info).toHaveAttribute("aria-expanded", "false");
      expect(toggle).toHaveAttribute("aria-checked", "false");
      await user.click(info);
      const popup = screen.getByRole("dialog", { name: "Cloudflare Access" });
      expect(popup).toBeVisible();
      expect(info).toHaveAttribute("aria-controls", popup.id);
      expect(info).toHaveAttribute("aria-expanded", "true");
      expect(onChange).not.toHaveBeenCalled();
      expect(toggle).toHaveAttribute("aria-checked", "false");
      expect(popup).toHaveTextContent(
        mode === "add" ? "Client ID and Client Secret" : "saved Secret is never displayed",
      );
      expect(info.closest("form")).not.toContainElement(popup);
      await user.keyboard("{Enter}");
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      await user.keyboard(" ");
      expect(screen.getByRole("dialog")).toBeVisible();
      await user.keyboard("{Escape}");
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(info).toHaveFocus();
      await user.pointer([{ keys: "[TouchA>]", target: info }, { keys: "[/TouchA]" }]);
      expect(screen.getByRole("dialog")).toBeVisible();
      await user.click(info);
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(onChange).not.toHaveBeenCalled();
      expect(submit).not.toHaveBeenCalled();
      await user.click(toggle);
      expect(onChange).toHaveBeenCalledWith(true);
      expect(submit).not.toHaveBeenCalled();
    },
  );

  it("keeps explanatory help available while the switch is disabled", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <CloudflareAccessControl
        mode="detail"
        label="Cloudflare Access"
        description="Add Access authentication"
        checked={false}
        onChange={onChange}
        disabled
      />,
    );

    const toggle = screen.getByRole("switch", { name: "Cloudflare Access" });
    expect(toggle).toHaveAttribute("aria-disabled", "true");
    await user.click(screen.getByRole("button", { name: "About Cloudflare Access" }));
    expect(screen.getByRole("dialog", { name: "Cloudflare Access" })).toBeVisible();
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(onChange).not.toHaveBeenCalled();
  });
});
