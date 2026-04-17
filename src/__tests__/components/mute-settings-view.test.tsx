import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MuteSettingsView } from "@/components/settings/mute-settings-view";

describe("MuteSettingsView", () => {
  it("uses softened helper tones for coming-soon and empty-state support copy", () => {
    render(
      <MuteSettingsView
        title="Mute"
        addHeading="Add muted keyword"
        intro="Hide articles that match these rules. Turning this on will also mark existing matches as read."
        keywordLabel="Keyword"
        keywordValue=""
        keywordPlaceholder="spoiler"
        scopeAriaLabel="Mute scope"
        scopeValue="title"
        scopeOptions={[
          { value: "title", label: "Title" },
          { value: "body", label: "Body" },
          { value: "title_and_body", label: "Title and body" },
        ]}
        addLabel="Add"
        onKeywordChange={vi.fn()}
        onScopeChange={vi.fn()}
        onAdd={vi.fn()}
        addDisabled={true}
        savedHeading="Saved rules"
        emptyState="No mute keywords yet."
        rules={[]}
        savedScopeAriaLabel={() => "Saved scope"}
        onRuleScopeChange={vi.fn()}
        deleteLabel="Delete"
        onRequestDelete={vi.fn()}
        autoMarkReadHeading="Auto mark as read"
        autoMarkReadLabel="Mark muted items as read"
        autoMarkReadChecked={false}
        autoMarkReadDisabled={false}
        autoMarkReadHint="Existing matches are marked read immediately. Turning this off does not restore unread state."
        onAutoMarkReadChange={vi.fn()}
        confirmOpen={false}
        confirmMessage="Delete muted keyword?"
        confirmActionLabel="Delete"
        cancelLabel="Cancel"
        onConfirmDelete={vi.fn()}
        onCancelDelete={vi.fn()}
      />,
    );

    expect(
      screen.getByText(
        "Hide articles that match these rules. Turning this on will also mark existing matches as read.",
      ),
    ).toHaveClass("text-foreground-soft");
    expect(
      screen.getByText("Existing matches are marked read immediately. Turning this off does not restore unread state."),
    ).toHaveClass("text-foreground-soft");
    expect(screen.getByText("No mute keywords yet.")).toHaveClass("text-foreground-soft");
    expect(screen.getByRole("switch", { name: "Mark muted items as read" })).not.toHaveAttribute("aria-disabled");
  });

  it("keeps mute controls on the shared right-side settings rail", () => {
    render(
      <MuteSettingsView
        title="Mute"
        addHeading="Add muted keyword"
        intro="Hide articles that match these rules."
        keywordLabel="Keyword"
        keywordValue=""
        keywordPlaceholder="spoiler"
        scopeAriaLabel="Mute scope"
        scopeValue="title"
        scopeOptions={[
          { value: "title", label: "Title" },
          { value: "body", label: "Body" },
          { value: "title_and_body", label: "Title and body" },
        ]}
        addLabel="Add"
        onKeywordChange={vi.fn()}
        onScopeChange={vi.fn()}
        onAdd={vi.fn()}
        addDisabled={false}
        savedHeading="Saved rules"
        emptyState="No mute keywords yet."
        rules={[{ id: "rule-1", keyword: "Supreme", scope: "title_and_body" }]}
        savedScopeAriaLabel={() => "Saved scope"}
        onRuleScopeChange={vi.fn()}
        deleteLabel="Delete"
        onRequestDelete={vi.fn()}
        autoMarkReadHeading="Auto mark as read"
        autoMarkReadLabel="Mark muted items as read"
        autoMarkReadChecked={false}
        autoMarkReadDisabled={false}
        autoMarkReadHint="Existing matches are marked read immediately."
        onAutoMarkReadChange={vi.fn()}
        confirmOpen={false}
        confirmMessage="Delete muted keyword?"
        confirmActionLabel="Delete"
        cancelLabel="Cancel"
        onConfirmDelete={vi.fn()}
        onCancelDelete={vi.fn()}
      />,
    );

    expect(screen.getByTestId("mute-settings-add-row")).toHaveClass("sm:min-w-[30rem]", "sm:justify-end");
    expect(screen.getByRole("textbox", { name: "Keyword" })).toHaveClass("sm:w-[220px]");
    expect(screen.getByRole("combobox", { name: "Mute scope" })).toHaveClass("sm:w-[192px]");
    expect(screen.getByRole("combobox", { name: "Saved scope" })).toHaveClass("sm:w-[192px]");
  });
});
