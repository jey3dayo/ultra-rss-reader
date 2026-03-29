import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AccountGeneralSectionView } from "@/components/settings/account-general-section-view";

describe("AccountGeneralSectionView", () => {
  it("renders the account name row and static account info", async () => {
    const user = userEvent.setup();
    const onStartEditingName = vi.fn();

    render(
      <AccountGeneralSectionView
        heading="General"
        nameLabel="Description"
        nameValue="Personal FreshRSS"
        editNameTitle="Click to edit"
        isEditingName={false}
        nameDraft="Personal FreshRSS"
        infoRows={[
          { label: "Type", value: "FreshRSS" },
          { label: "Server", value: "https://freshrss.example.com", truncate: true },
        ]}
        onStartEditingName={onStartEditingName}
        onNameDraftChange={() => {}}
        onCommitName={() => {}}
        onNameKeyDown={() => {}}
      />,
    );

    expect(screen.getByRole("heading", { level: 3, name: "General" })).toBeInTheDocument();
    expect(screen.getByText("Description")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Personal FreshRSS" })).toBeInTheDocument();
    expect(screen.getByText("FreshRSS")).toBeInTheDocument();
    expect(screen.getByText("https://freshrss.example.com")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Personal FreshRSS" }));

    expect(onStartEditingName).toHaveBeenCalledTimes(1);
  });

  it("renders a controlled input while editing and delegates input events", () => {
    const onNameDraftChange = vi.fn();
    const onCommitName = vi.fn();
    const onNameKeyDown = vi.fn();

    render(
      <AccountGeneralSectionView
        heading="General"
        nameLabel="Description"
        nameValue="Personal FreshRSS"
        editNameTitle="Click to edit"
        isEditingName={true}
        nameDraft="Personal FreshRSS"
        infoRows={[{ label: "Type", value: "FreshRSS" }]}
        onStartEditingName={() => {}}
        onNameDraftChange={onNameDraftChange}
        onCommitName={onCommitName}
        onNameKeyDown={onNameKeyDown}
      />,
    );

    const input = screen.getByDisplayValue("Personal FreshRSS");

    fireEvent.change(input, { target: { value: "Renamed account" } });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.blur(input);

    expect(onNameDraftChange).toHaveBeenCalledWith("Renamed account");
    expect(onNameKeyDown).toHaveBeenCalledTimes(1);
    expect(onCommitName).toHaveBeenCalledTimes(1);
  });
});
