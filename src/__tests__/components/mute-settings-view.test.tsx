import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { handleMuteKeywordScopeSelectValue } from "@/components/settings/mute-keyword-scope-select";
import { MuteSettingsView } from "@/components/settings/mute-settings-view";

describe("mute keyword scope select policy", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("emits diagnostics and ignores invalid scope select values", () => {
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const onScopeChange = vi.fn();

    handleMuteKeywordScopeSelectValue("surprise", onScopeChange, {
      source: "saved-rule",
      ruleId: "rule-1",
    });

    expect(onScopeChange).not.toHaveBeenCalled();
    expect(consoleWarn).toHaveBeenCalledWith("Ignored invalid mute keyword scope select value", {
      source: "saved-rule",
      ruleId: "rule-1",
      value: "surprise",
    });
  });
});

describe("MuteSettingsView", () => {
  it("keeps the auto-read warning visible and reveals its details on demand", async () => {
    const user = userEvent.setup();
    const onAutoMarkReadChange = vi.fn();
    render(
      <MuteSettingsView
        title="Mute"
        addHeading="Add muted keyword"
        intro="Muted matches stay out of lists and search."
        keywordLabel="Keyword"
        keywordHint="At least 3 characters"
        keywordHelp="Muted keywords are hidden from lists and search. Use at least 3 characters. Case-insensitive matching applies to ASCII letters only."
        keywordInfoAriaLabel="Show keyword rules"
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
        autoMarkReadSummary="Existing matches become read; turning this off does not restore unread state."
        autoMarkReadInfoAriaLabel="Show auto mark as read details"
        autoMarkReadHint="Turning this on marks existing muted matches as read immediately. Turning it off does not restore unread state."
        onAutoMarkReadChange={onAutoMarkReadChange}
        confirmOpen={false}
        confirmMessage="Delete muted keyword?"
        confirmActionLabel="Delete"
        cancelLabel="Cancel"
        onConfirmDelete={vi.fn()}
        onCancelDelete={vi.fn()}
      />,
    );

    expect(screen.getByText("Muted matches stay out of lists and search.")).toHaveClass("text-foreground-soft");
    expect(
      screen.getByText("Existing matches become read; turning this off does not restore unread state."),
    ).toHaveClass("text-foreground-soft");
    expect(screen.getByText("At least 3 characters")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Keyword" })).toHaveAccessibleDescription("At least 3 characters");
    expect(
      screen.queryByText(
        "Turning this on marks existing muted matches as read immediately. Turning it off does not restore unread state.",
      ),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Show auto mark as read details" }));
    expect(
      screen.getByText(
        "Turning this on marks existing muted matches as read immediately. Turning it off does not restore unread state.",
      ),
    ).toBeInTheDocument();
    expect(onAutoMarkReadChange).not.toHaveBeenCalled();
    expect(screen.getByText("No mute keywords yet.")).toHaveClass("motion-content-swap", "text-foreground-soft");
    expect(screen.getByText("No mute keywords yet.")).toHaveAttribute("data-motion-phase", "entering");
    expect(screen.getByRole("switch", { name: "Mark muted items as read" })).not.toHaveAttribute("aria-disabled");
    await user.click(screen.getByRole("switch", { name: "Mark muted items as read" }));
    expect(onAutoMarkReadChange).toHaveBeenCalledTimes(1);
    expect(onAutoMarkReadChange.mock.calls[0]?.[0]).toBe(true);
  });

  it("keeps concise keyword guidance visible and reveals matching rules on demand", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(
      <MuteSettingsView
        title="Mute"
        addHeading="Add muted keyword"
        intro="Muted matches stay out of lists and search."
        keywordLabel="Keyword"
        keywordHint="At least 3 characters"
        keywordHelp="Muted keywords are hidden from lists and search. Use at least 3 characters. Case-insensitive matching applies to ASCII letters only."
        keywordInfoAriaLabel="Show keyword rules"
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
        onAdd={onAdd}
        addDisabled={false}
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
        autoMarkReadSummary="Existing matches become read; turning this off does not restore unread state."
        autoMarkReadInfoAriaLabel="Show auto mark as read details"
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

    expect(screen.getByText("At least 3 characters")).toBeInTheDocument();
    expect(
      screen.queryByText(
        "Muted keywords are hidden from lists and search. Use at least 3 characters. Case-insensitive matching applies to ASCII letters only.",
      ),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Show keyword rules" }));
    expect(
      screen.getByText(
        "Muted keywords are hidden from lists and search. Use at least 3 characters. Case-insensitive matching applies to ASCII letters only.",
      ),
    ).toBeInTheDocument();
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("keeps mute controls on the shared right-side settings rail", async () => {
    const user = userEvent.setup();
    const onScopeChange = vi.fn();
    render(
      <MuteSettingsView
        title="Mute"
        addHeading="Add muted keyword"
        intro="Hide articles that match these rules."
        keywordLabel="Keyword"
        keywordHint="At least 3 characters"
        keywordHelp="Muted keywords are hidden from lists and search. Use at least 3 characters. Case-insensitive matching applies to ASCII letters only."
        keywordInfoAriaLabel="Show keyword rules"
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
        onScopeChange={onScopeChange}
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
        autoMarkReadSummary="Existing matches become read; turning this off does not restore unread state."
        autoMarkReadInfoAriaLabel="Show auto mark as read details"
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

    expect(screen.getByTestId("mute-settings-add-row")).toHaveClass("space-y-2.5");
    expect(screen.getByTestId("mute-settings-add-row")).not.toHaveClass("sm:max-w-[30rem]");
    expect(screen.getByRole("textbox", { name: "Keyword" })).toHaveClass("min-w-0", "h-9");
    expect(screen.getByRole("textbox", { name: "Keyword" })).not.toHaveClass("sm:col-span-2");
    expect(screen.getByRole("combobox", { name: "Mute scope" })).toHaveClass("min-w-0", "w-full");
    expect(screen.getByTestId("mute-settings-row-rule-1")).toHaveClass(
      "min-h-12",
      "justify-between",
      "last:border-b-0",
    );
    expect(screen.getByRole("combobox", { name: "Saved scope" })).toHaveClass("h-9", "w-[9.5rem]");
    expect(screen.getByRole("button", { name: "Add" })).toHaveClass("h-9", "px-4");
    expect(screen.getByRole("button", { name: "Add" })).toHaveClass("min-h-9", "min-w-11");
    expect(screen.getByRole("button", { name: "Delete" })).toHaveClass("size-8");
    expect(screen.getByRole("button", { name: "Delete" }).querySelector("svg")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Mark muted items as read" })).toHaveClass(
      "before:inset-[-10px]",
      "before:content-['']",
    );

    await user.click(screen.getByRole("combobox", { name: "Mute scope" }));
    await user.click(await screen.findByRole("option", { name: "Body" }));

    expect(onScopeChange).toHaveBeenCalledWith("body");
  });

  it("submits mute keyword creation with Enter and ignores disabled submits", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();

    const { rerender } = render(
      <MuteSettingsView
        title="Mute"
        addHeading="Add muted keyword"
        intro="Hide articles that match these rules."
        keywordLabel="Keyword"
        keywordHint="At least 3 characters"
        keywordHelp="Muted keywords are hidden from lists and search. Use at least 3 characters. Case-insensitive matching applies to ASCII letters only."
        keywordInfoAriaLabel="Show keyword rules"
        keywordValue="spoiler"
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
        onAdd={onAdd}
        addDisabled={false}
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
        autoMarkReadSummary="Existing matches become read; turning this off does not restore unread state."
        autoMarkReadInfoAriaLabel="Show auto mark as read details"
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

    await user.type(screen.getByRole("textbox", { name: "Keyword" }), "{Enter}");
    expect(onAdd).toHaveBeenCalledTimes(1);

    rerender(
      <MuteSettingsView
        title="Mute"
        addHeading="Add muted keyword"
        intro="Hide articles that match these rules."
        keywordLabel="Keyword"
        keywordHint="At least 3 characters"
        keywordHelp="Muted keywords are hidden from lists and search. Use at least 3 characters. Case-insensitive matching applies to ASCII letters only."
        keywordInfoAriaLabel="Show keyword rules"
        keywordValue="spoiler"
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
        onAdd={onAdd}
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
        autoMarkReadSummary="Existing matches become read; turning this off does not restore unread state."
        autoMarkReadInfoAriaLabel="Show auto mark as read details"
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

    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
    await user.type(screen.getByRole("textbox", { name: "Keyword" }), "{Enter}");
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it("shows pending feedback and blocks repeated mute keyword creation", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();

    render(
      <MuteSettingsView
        title="Mute"
        addHeading="Add muted keyword"
        intro="Hide articles that match these rules."
        keywordLabel="Keyword"
        keywordHint="At least 3 characters"
        keywordHelp="Muted keywords are hidden from lists and search. Use at least 3 characters. Case-insensitive matching applies to ASCII letters only."
        keywordInfoAriaLabel="Show keyword rules"
        keywordValue="spoiler"
        keywordPlaceholder="spoiler"
        scopeAriaLabel="Mute scope"
        scopeValue="title"
        scopeOptions={[
          { value: "title", label: "Title" },
          { value: "body", label: "Body" },
          { value: "title_and_body", label: "Title and body" },
        ]}
        addLabel="Add"
        addPendingLabel="Adding..."
        addPending
        onKeywordChange={vi.fn()}
        onScopeChange={vi.fn()}
        onAdd={onAdd}
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
        autoMarkReadSummary="Existing matches become read; turning this off does not restore unread state."
        autoMarkReadInfoAriaLabel="Show auto mark as read details"
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

    const addButton = screen.getByRole("button", { name: "Adding..." });

    expect(addButton).toBeDisabled();
    expect(addButton).toHaveAttribute("aria-busy", "true");

    await user.click(addButton);
    await user.type(screen.getByRole("textbox", { name: "Keyword" }), "{Enter}");

    expect(onAdd).not.toHaveBeenCalled();
  });

  it("protects long saved mute keywords from mobile overflow", () => {
    render(
      <MuteSettingsView
        title="Mute"
        addHeading="Add muted keyword"
        intro="Hide articles that match these rules."
        keywordLabel="Keyword"
        keywordHint="At least 3 characters"
        keywordHelp="Muted keywords are hidden from lists and search. Use at least 3 characters. Case-insensitive matching applies to ASCII letters only."
        keywordInfoAriaLabel="Show keyword rules"
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
        rules={[
          {
            id: "rule-1",
            keyword: "averyveryveryveryveryveryveryverylongunbrokenkeyword",
            scope: "title_and_body",
          },
        ]}
        savedScopeAriaLabel={() => "Saved scope"}
        onRuleScopeChange={vi.fn()}
        deleteLabel="Delete"
        onRequestDelete={vi.fn()}
        autoMarkReadHeading="Auto mark as read"
        autoMarkReadLabel="Mark muted items as read"
        autoMarkReadChecked={false}
        autoMarkReadDisabled={false}
        autoMarkReadSummary="Existing matches become read; turning this off does not restore unread state."
        autoMarkReadInfoAriaLabel="Show auto mark as read details"
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

    expect(screen.getByText("averyveryveryveryveryveryveryverylongunbrokenkeyword")).toHaveClass("min-w-0", "truncate");
  });
});
