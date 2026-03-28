import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { AddFeedDialog } from "@/components/reader/add-feed-dialog";
import { RenameDialog } from "@/components/reader/rename-feed-dialog";
import { AddAccountForm } from "@/components/settings/add-account-form";
import { SettingsSelect } from "@/components/settings/settings-components";
import { createWrapper } from "../../../tests/helpers/create-wrapper";
import { sampleFeeds } from "../../../tests/helpers/tauri-mocks";

describe("Form fields", () => {
  it("settings select exposes a name attribute", () => {
    render(
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

    expect(screen.getByRole("combobox")).toHaveAttribute("name");
  });

  it("add account form inputs expose name attributes", async () => {
    const user = userEvent.setup();
    const { container } = render(<AddAccountForm />, { wrapper: createWrapper() });

    expect(screen.getByRole("combobox")).toHaveAttribute("name");
    expect(screen.getByPlaceholderText("Local")).toHaveAttribute("name");

    await user.selectOptions(screen.getByRole("combobox"), "FreshRss");

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
