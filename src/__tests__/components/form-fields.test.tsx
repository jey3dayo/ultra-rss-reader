import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { AddFeedDialog } from "@/components/reader/add-feed-dialog";
import { RenameDialog } from "@/components/reader/rename-feed-dialog";
import { AddAccountForm } from "@/components/settings/add-account-form";
import { SettingsSelect } from "@/components/settings/settings-components";
import { createWrapper } from "../../../tests/helpers/create-wrapper";
import { sampleFeeds } from "../../../tests/helpers/tauri-mocks";

async function selectAccountType(user: ReturnType<typeof userEvent.setup>, optionName: string) {
  await user.click(screen.getByRole("combobox"));
  await user.click(await screen.findByRole("option", { name: optionName }));
}

describe("Form fields", () => {
  it("settings select exposes a name attribute", () => {
    const { container } = render(
      <SettingsSelect
        label="Open links"
        prefKey="open_links"
        options={[
          { value: "in_app", label: "In-app browser" },
          { value: "external", label: "Default browser" },
        ]}
      />,
      { wrapper: createWrapper() },
    );

    expect(container.querySelector('input[name="open_links"]')).not.toBeNull();
  });

  it("add account form inputs expose name attributes", async () => {
    const user = userEvent.setup();
    const { container } = render(<AddAccountForm />, { wrapper: createWrapper() });

    expect(container.querySelector('input[name="account-type"]')).not.toBeNull();
    expect(screen.getByPlaceholderText("Local")).toHaveAttribute("name");

    await selectAccountType(user, "FreshRSS");

    expect(screen.getByPlaceholderText("https://your-freshrss.com")).toHaveAttribute("name");
    expect(container.querySelector('input[name="username"]')).not.toBeNull();
    expect(container.querySelector('input[name="password"]')).not.toBeNull();
  });

  it("add feed dialog input exposes a name attribute", () => {
    render(<AddFeedDialog open={true} onOpenChange={() => {}} accountId="acc-1" />, { wrapper: createWrapper() });

    expect(screen.getByPlaceholderText("Feed or Site URL")).toHaveAttribute("name");
  });

  it("rename feed dialog input exposes a name attribute", () => {
    render(<RenameDialog feed={sampleFeeds[0]} open={true} onOpenChange={() => {}} />, { wrapper: createWrapper() });

    expect(screen.getByDisplayValue(sampleFeeds[0].title)).toHaveAttribute("name");
  });
});
