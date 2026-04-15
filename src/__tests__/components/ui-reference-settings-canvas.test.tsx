import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AnnotatedSettingsCanvas } from "@/components/storybook/ui-reference-settings-canvas.stories";

describe("AnnotatedSettingsCanvas story", () => {
  it("renders the annotated settings reference canvas with the main UI specimens", () => {
    render(<AnnotatedSettingsCanvas />);

    expect(screen.getByRole("navigation", { name: "Reference settings sections" })).toBeInTheDocument();
    expect(screen.getByText("Left Band")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Annotated controls" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Drag handle pattern" })).toBeInTheDocument();

    expect(screen.getByRole("textbox", { name: "Feed URL" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Density" })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Live Preview" })).toBeInTheDocument();
    expect(screen.getByText("Validation row")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Server URL" })).toBeInTheDocument();
    expect(screen.getByText("URL は `https://` から始めてください。")).toBeInTheDocument();

    const modeGroup = screen.getByRole("radiogroup", { name: "Reading mode" });
    expect(within(modeGroup).getByRole("radio", { name: "Comfortable" })).toBeInTheDocument();
    expect(within(modeGroup).getByRole("radio", { name: "Compact" })).toBeInTheDocument();

    const dragHandle = screen.getByLabelText("Reorder Reading layout");
    expect(dragHandle).toBeInTheDocument();
    expect(screen.getByText("Reading layout")).toBeInTheDocument();
    expect(screen.getByText("Drag this row to reorder priority")).toBeInTheDocument();

    const filterGroup = screen.getByRole("group", { name: "記事フィルター" });
    expect(within(filterGroup).getByRole("button", { name: "未読" })).toBeInTheDocument();
    expect(within(filterGroup).getByRole("button", { name: "すべて" })).toBeInTheDocument();
    expect(within(filterGroup).getByRole("button", { name: "スター" })).toBeInTheDocument();

    expect(screen.getByText("Account card stack")).toBeInTheDocument();
    expect(screen.getByText("Local")).toBeInTheDocument();
    expect(screen.getByText("FreshRSS")).toBeInTheDocument();
    expect(screen.getByText("debug")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "アカウントを追加..." })).toBeInTheDocument();

    expect(screen.getByText("Announcement cards")).toBeInTheDocument();
    expect(screen.getByText("確認待ち")).toBeInTheDocument();
    expect(screen.getByText("判断済み")).toBeInTheDocument();

    expect(screen.getByText("Folder stack")).toBeInTheDocument();
    expect(screen.getByText("Interior")).toBeInTheDocument();
    expect(screen.getByText("99% DIY -DIYブログ-")).toBeInTheDocument();
    expect(screen.getByText("CAFICT")).toBeInTheDocument();

    expect(screen.getByText("Tag palette")).toBeInTheDocument();
    expect(screen.getByText("カラー")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "色なし" })).toBeInTheDocument();

    expect(screen.getByText("Disabled switch")).toBeInTheDocument();
    expect(screen.getByText("工事中")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "ミュート時に自動既読" })).toHaveAttribute("aria-disabled", "true");

    expect(screen.getByText("Dialog surface")).toBeInTheDocument();
    expect(screen.getByText("この購読を削除しますか？")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "削除する" })).toBeInTheDocument();

    expect(screen.getByText("Context menu")).toBeInTheDocument();
    expect(screen.getByText("Open site")).toBeInTheDocument();
    expect(screen.getByText("Mark all as read")).toBeInTheDocument();
  });
});
