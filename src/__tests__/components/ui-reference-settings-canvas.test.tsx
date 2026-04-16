import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { InputControlsCanvas } from "@/components/storybook/ui-reference-settings-canvas.stories";
import { ShellOverlayCanvas } from "@/components/storybook/ui-reference-shell-overlay-canvas.stories";
import { ViewSpecimensCanvas } from "@/components/storybook/ui-reference-view-specimens-canvas.stories";

describe("UI Reference canvases", () => {
  it("renders the input controls canvas with form specimens", () => {
    render(<InputControlsCanvas />);

    expect(screen.getByText("Input controls")).toBeInTheDocument();
    expect(screen.getAllByTestId("reference-annotated-note")[0]).toHaveClass("rounded-md");
    expect(screen.getByTestId("reference-validation-frame")).toHaveClass("rounded-md");
    expect(screen.getByTestId("reference-disabled-switch-frame")).toHaveClass("rounded-md");
    expect(screen.getByRole("textbox", { name: "Feed URL" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Density" })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Live Preview" })).toBeInTheDocument();

    expect(screen.getByText("Validation row")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Server URL" })).toBeInTheDocument();
    expect(screen.getByText("URL は `https://` から始めてください。")).toBeInTheDocument();

    const modeGroup = screen.getByRole("radiogroup", { name: "Reading mode" });
    expect(within(modeGroup).getByRole("radio", { name: "Comfortable" })).toBeInTheDocument();
    expect(within(modeGroup).getByRole("radio", { name: "Compact" })).toBeInTheDocument();

    expect(screen.getByText("Disabled switch")).toBeInTheDocument();
    expect(screen.getByText("工事中")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "ミュート時に自動既読" })).toHaveAttribute("aria-disabled", "true");
  });

  it("renders the shell and overlay canvas with framing specimens", () => {
    render(<ShellOverlayCanvas />);

    expect(screen.getByText("Shell & overlay")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Reference settings sections" })).toBeInTheDocument();
    expect(screen.getByText("Left Band")).toBeInTheDocument();
    expect(screen.getByText("Main content shell")).toBeInTheDocument();
    expect(screen.getByText("Left Band").closest("aside")).toHaveClass("rounded-xl");
    expect(screen.getByRole("navigation", { name: "Reference settings sections" }).parentElement).toHaveClass(
      "rounded-lg",
    );
    expect(screen.getByText("Main content shell").closest("div")?.parentElement?.parentElement).toHaveClass(
      "rounded-xl",
    );

    expect(screen.getByText("Dialog surface")).toBeInTheDocument();
    expect(screen.getByText("この購読を削除しますか？")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "削除する" })).toBeInTheDocument();
    expect(screen.getByText(/Outer shell only\./).closest("div")).toHaveClass("rounded-xl");
    expect(screen.getByText("Dialog shell frame").parentElement).toHaveClass("rounded-lg");

    expect(screen.getByText("Context menu")).toBeInTheDocument();
    expect(screen.getByText("Open site")).toBeInTheDocument();
    expect(screen.getByText("Mark all as read")).toBeInTheDocument();
    expect(
      screen
        .getByText("This is the workspace frame around the menu body, not the reusable menu body itself.")
        .closest("div"),
    ).toHaveClass("rounded-xl");
    expect(screen.getByText("Context menu shell frame").parentElement).toHaveClass("rounded-lg");
  });

  it("renders the view specimens canvas with display fragments", () => {
    render(<ViewSpecimensCanvas />);

    expect(screen.getByText("View specimens")).toBeInTheDocument();
    expect(screen.getByTestId("reference-filter-strip-frame")).toHaveClass("rounded-md");
    expect(screen.getByTestId("reference-workspace-filter-cluster-frame")).toHaveClass("rounded-md");
    expect(screen.getByTestId("reference-account-card-frame")).toHaveClass("rounded-md");
    expect(screen.getByTestId("reference-announcement-card-pending")).toHaveClass("rounded-md");
    expect(screen.getByTestId("reference-announcement-card-decided")).toHaveClass("rounded-md");
    expect(screen.getByTestId("reference-folder-stack-frame")).toHaveClass("rounded-md");
    expect(screen.getByText("Surface roles")).toBeInTheDocument();
    expect(screen.getByText("Info surface")).toBeInTheDocument();
    expect(screen.getByText("Section surface")).toBeInTheDocument();

    const filterGroup = screen.getByRole("group", { name: "記事フィルター" });
    expect(within(filterGroup).getByRole("button", { name: "未読" })).toBeInTheDocument();
    expect(within(filterGroup).getByRole("button", { name: "すべて" })).toBeInTheDocument();
    expect(within(filterGroup).getByRole("button", { name: "スター" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "すべて163" })).toHaveClass("rounded-md");
    expect(within(screen.getByRole("button", { name: "すべて163" })).getByText("163")).toHaveClass("rounded-sm");

    const accountSection = screen.getByText("Account card stack").closest("section") ?? document.body;
    expect(within(accountSection).getByText("Local")).toBeInTheDocument();
    expect(within(accountSection).getAllByText("FreshRSS").length).toBeGreaterThan(0);
    expect(within(accountSection).getByText("debug")).toBeInTheDocument();
    expect(within(accountSection).getByRole("button", { name: "アカウントを追加..." })).toBeInTheDocument();

    expect(screen.getByText("Folder stack")).toBeInTheDocument();
    expect(screen.getByText("Interior")).toBeInTheDocument();
    expect(screen.getByText("99% DIY -DIYブログ-")).toBeInTheDocument();
    expect(screen.getByText("CAFICT")).toBeInTheDocument();

    expect(screen.getByText("Announcement cards")).toBeInTheDocument();
    expect(screen.getByText("確認待ち")).toBeInTheDocument();
    expect(screen.getByText("判断済み")).toBeInTheDocument();

    expect(screen.getByText("Tag palette")).toBeInTheDocument();
    expect(screen.getByText("カラー")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "色なし" })).toBeInTheDocument();
  });
});
