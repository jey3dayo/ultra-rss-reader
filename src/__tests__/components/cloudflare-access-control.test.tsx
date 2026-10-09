import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { FormEvent } from "react";
import { describe, expect, it, vi } from "vitest";
import { CloudflareAccessControl } from "@/components/settings/shared/cloudflare-access-control";

describe("CloudflareAccessControl", () => {
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
      expect(popup).toHaveTextContent(mode === "add" ? "OS keyring" : "Turn Access off and save");
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
