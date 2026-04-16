import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MuteSettingsView } from "@/components/settings/mute-settings-view";

describe("MuteSettingsView", () => {
  it("uses softened helper tones for coming-soon and empty-state support copy", () => {
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
        comingSoonLabel="Coming soon"
        autoMarkReadHint="This behavior will be added later."
        confirmOpen={false}
        confirmMessage="Delete muted keyword?"
        confirmActionLabel="Delete"
        cancelLabel="Cancel"
        onConfirmDelete={vi.fn()}
        onCancelDelete={vi.fn()}
      />,
    );

    expect(screen.getByText("Hide articles that match these rules.")).toHaveClass("text-foreground-soft");
    expect(screen.getByText("This behavior will be added later.")).toHaveClass("text-foreground-soft");
    expect(screen.getByText("No mute keywords yet.")).toHaveClass("text-foreground-soft");
    expect(screen.getByText("Coming soon")).toHaveClass("text-foreground-soft");
  });
});
