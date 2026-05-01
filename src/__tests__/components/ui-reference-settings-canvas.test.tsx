import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ButtonControlsCanvas } from "@/components/storybook/ui-reference-button-controls-canvas.stories";
import { ShellExamplesSpecimen, SurfaceRoleSpecimen } from "@/components/storybook/ui-reference-canvas-specimens";
import { FoundationsCanvas } from "@/components/storybook/ui-reference-foundations-canvas.stories";
import { NavigationCollectionsCanvas } from "@/components/storybook/ui-reference-navigation-collections-canvas.stories";
import { InputControlsCanvas } from "@/components/storybook/ui-reference-settings-canvas.stories";
import { SettingsWorkspaceCanvas } from "@/components/storybook/ui-reference-settings-workspace-canvas.stories";
import { ShellOverlayCanvas } from "@/components/storybook/ui-reference-shell-overlay-canvas.stories";
import { ViewSpecimensCanvas } from "@/components/storybook/ui-reference-workspace-patterns-canvas.stories";

describe("UI Reference canvases", () => {
  it("renders the button controls canvas with action family specimens", () => {
    render(<ButtonControlsCanvas />);

    expect(screen.getByText("Button controls")).toBeInTheDocument();
    expect(screen.getByTestId("reference-button-family-guide")).toBeInTheDocument();
    expect(screen.getByText("SettingsActionButton")).toBeInTheDocument();
    expect(screen.getByTestId("reference-button-variant-matrix")).toBeInTheDocument();
    expect(screen.getByTestId("reference-button-size-matrix")).toBeInTheDocument();
    expect(screen.getByTestId("reference-settings-action-button-matrix")).toBeInTheDocument();
    expect(screen.getByTestId("reference-form-loading-actions")).toBeInTheDocument();
    expect(screen.getByTestId("reference-semantic-action-buttons")).toBeInTheDocument();
    expect(screen.getByTestId("reference-article-filter-toggle-buttons")).toBeInTheDocument();
    expect(screen.getByTestId("reference-reader-header-action-strip")).toBeInTheDocument();
    expect(screen.getByTestId("reference-icon-utility-buttons")).toBeInTheDocument();
    expect(screen.getByTestId("reference-navigation-button-patterns")).toBeInTheDocument();
    expect(screen.getByTestId("reference-specialized-button-patterns")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete permanently" })).toHaveAttribute("data-delete-button");
    expect(screen.getByRole("button", { name: "Shortcut" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove design" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Press a key" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add tag" })).toHaveClass("rounded-full", "min-h-6");
    expect(screen.getByRole("button", { name: "Add compact tag" })).toHaveClass("rounded-full", "gap-0");
    expect(screen.getByRole("button", { name: "design" })).toHaveClass("motion-static-hover-surface", "rounded-md");
    expect(screen.getByRole("button", { name: "Local Today at 10:42" })).toHaveAttribute("aria-haspopup", "menu");
    expect(screen.getByRole("button", { name: "Single Not synced yet" })).not.toHaveAttribute("aria-haspopup");
    expect(screen.getByRole("button", { name: "General Account and settings section row 12" })).toBeInTheDocument();
  });

  it("lets the reader header action strip toggle article states in the reference canvas", async () => {
    const user = userEvent.setup();
    render(<ButtonControlsCanvas />);

    const readButton = screen.getByRole("button", { name: "Toggle read" });
    const starButton = screen.getByRole("button", { name: "Toggle star" });
    const previewButton = screen.getByRole("button", { name: "Open Web Preview" });

    expect(readButton).toHaveAttribute("aria-pressed", "false");
    expect(starButton).toHaveAttribute("aria-pressed", "true");
    expect(previewButton).toHaveAttribute("aria-pressed", "false");

    await user.click(readButton);
    await user.click(starButton);
    await user.click(previewButton);

    expect(readButton).toHaveAttribute("aria-pressed", "true");
    expect(starButton).toHaveAttribute("aria-pressed", "false");
    expect(
      within(screen.getByTestId("reference-reader-header-action-strip")).getByRole("button", {
        name: "Close Web Preview",
      }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("renders the settings sections canvas with form specimens", () => {
    render(<InputControlsCanvas />);

    expect(screen.getByText("Input controls")).toBeInTheDocument();
    expect(screen.getAllByTestId("reference-annotated-note")[0]).toHaveClass("rounded-md");
    expect(screen.getByTestId("reference-validation-frame")).toHaveClass("rounded-md");
    expect(screen.getByTestId("reference-disabled-switch-frame")).toHaveClass("rounded-md");
    expect(screen.getAllByRole("textbox", { name: "Display name" })[0]).toHaveClass("h-10", "flex-1");
    expect(screen.getByRole("button", { name: "Reset: Display name" })).toHaveClass("h-10", "px-4");
    expect(screen.getByRole("textbox", { name: "Tag name" })).toHaveClass("h-10", "flex-1");
    expect(screen.getByRole("button", { name: "Create" })).toHaveClass("h-10", "px-4");
    expect(screen.getByRole("textbox", { name: "API token" })).toHaveClass("pr-11");
    expect(screen.getByRole("button", { name: "Reset token" })).toHaveClass("absolute", "right-1");
    expect(screen.getByRole("combobox", { name: "Density" })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Live Preview" })).toBeInTheDocument();

    expect(screen.getByText("Validation row")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Server URL" })).toBeInTheDocument();
    expect(screen.getByText("URL は `https://` から始めてください。")).toBeInTheDocument();

    const modeGroup = screen.getByRole("radiogroup", { name: "Reading mode" });
    expect(within(modeGroup).getByRole("radio", { name: "Comfortable" })).toBeInTheDocument();
    expect(within(modeGroup).getByRole("radio", { name: "Compact" })).toBeInTheDocument();
    expect(modeGroup).toHaveClass("justify-end");

    expect(screen.getByText("Disabled switch")).toBeInTheDocument();
    expect(screen.getByText("工事中")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "ミュート時に自動既読" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.queryByText("Shell examples")).not.toBeInTheDocument();
    expect(screen.queryByText("Dialog shell")).not.toBeInTheDocument();
  });

  it("renders the shell and overlay canvas with framing specimens", () => {
    render(<ShellOverlayCanvas />);

    expect(screen.getByText("Shell & overlay")).toBeInTheDocument();
    expect(screen.getByTestId("reference-update-toast-stability")).toBeInTheDocument();
    expect(screen.getByTestId("reference-update-toast-download-0")).toBeInTheDocument();
    expect(screen.getByTestId("reference-update-toast-download-90")).toBeInTheDocument();
    expect(screen.getByTestId("reference-update-toast-ready")).toBeInTheDocument();
    expect(screen.getByTestId("reference-update-toast-failure")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Reference settings sections" })).toBeInTheDocument();
    expect(screen.getByText("Left Band")).toBeInTheDocument();
    expect(screen.getByText("Main content shell")).toBeInTheDocument();
    expect(screen.getByText("Left Band").closest("aside")).toHaveClass("rounded-xl");
    expect(screen.getByRole("navigation", { name: "Reference settings sections" }).parentElement).toHaveClass(
      "rounded-lg",
    );
    expect(screen.getByRole("navigation", { name: "Reference settings sections" }).parentElement).toHaveClass(
      "border-[var(--sidebar-frame-border)]",
      "bg-[var(--sidebar-frame-surface)]",
    );
    expect(
      screen.getByText("Main content shell").closest('[data-testid="reference-annotated-note"]')?.parentElement,
    ).toHaveClass("rounded-lg");
    expect(
      screen.getByText("Main content shell").closest('[data-testid="reference-annotated-note"]')?.parentElement
        ?.parentElement?.parentElement,
    ).toHaveClass("rounded-xl");
    expect(
      screen.getByText("Section containers stay inside").closest('[data-testid="reference-annotated-note"]')
        ?.parentElement?.parentElement,
    ).toHaveClass("rounded-lg");
    expect(screen.getByText("Dialog shell")).toBeInTheDocument();
    expect(screen.getByText("この購読を削除しますか？")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "削除する" })).toBeInTheDocument();
    expect(screen.getByText(/Outer shell only\./).closest("div")).toHaveClass("rounded-xl");
    expect(screen.getByText("Dialog shell frame").parentElement).toHaveClass("rounded-lg");
    expect(screen.getByText("この購読を削除しますか？").parentElement?.parentElement).toHaveClass("rounded-lg");

    expect(screen.getByText("Context menu shell")).toBeInTheDocument();
    expect(screen.getAllByText("Open site").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Mark all as read").length).toBeGreaterThan(0);
    expect(
      screen
        .getByText("This is the workspace frame around the menu body, not the reusable menu body itself.")
        .closest("div"),
    ).toHaveClass("rounded-xl");
    expect(screen.getByText("Context menu shell frame").parentElement).toHaveClass("rounded-lg");
  });

  it("renders the foundations canvas with typography and semantic surfaces", () => {
    const { container } = render(<FoundationsCanvas />);

    expect(container.firstElementChild).toHaveClass("min-h-screen");
    expect(screen.getByText("Foundations")).toBeInTheDocument();
    expect(screen.getByText("Typography scale")).toBeInTheDocument();
    expect(screen.getAllByText("Display Hero").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Body Serif").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Mono Small").length).toBeGreaterThan(0);
    expect(screen.getByTestId("reference-semantic-state-grid")).toHaveClass("grid");
    expect(screen.getByText("Review accent")).toBeInTheDocument();
    expect(screen.getAllByText("Thinking accent").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Surface roles").length).toBeGreaterThan(0);
  });

  it("keeps non-shell card specimens on the rounded-md baseline while preserving shell examples", () => {
    render(
      <>
        <SurfaceRoleSpecimen />
        <ShellExamplesSpecimen />
      </>,
    );

    const surfaceRoleSurface = screen.getByText("Surface roles").closest('[data-surface-card="section"]');
    expect(surfaceRoleSurface).toHaveClass("rounded-md");
    expect(screen.getByText("Info surface").closest('[data-surface-card="info"]')).toHaveClass("rounded-md");
    expect(screen.getByText("Section surface").closest('[data-surface-card="section"]')).toHaveClass("rounded-md");

    expect(screen.getByText("Dialog shell frame").parentElement).toHaveClass("rounded-lg");
    expect(screen.getByText("Context menu shell frame").parentElement).toHaveClass("rounded-lg");
  });

  it("renders the navigation and collections canvas with list/navigation fragments", () => {
    render(<NavigationCollectionsCanvas />);

    expect(screen.getByText("Navigation & collections")).toBeInTheDocument();
    expect(screen.getByTestId("reference-filter-strip-frame")).toHaveClass("rounded-md");
    expect(screen.getByTestId("reference-account-card-frame")).toHaveClass("rounded-md");
    expect(screen.getByTestId("reference-folder-stack-frame")).toHaveClass("rounded-md");

    const filterGroup = screen.getByRole("group", { name: "記事フィルター" });
    expect(within(filterGroup).getByRole("button", { name: "未読" })).toBeInTheDocument();
    expect(within(filterGroup).getByRole("button", { name: "すべて" })).toBeInTheDocument();
    expect(within(filterGroup).getByRole("button", { name: "スター" })).toBeInTheDocument();
    expect(within(filterGroup).getByRole("button", { name: "すべて" })).toHaveClass(
      "data-[pressed]:bg-[var(--sidebar-pressed-surface)]",
    );

    const accountSection = screen.getByText("Account card stack").closest("section") ?? document.body;
    expect(within(accountSection).getByText("Local")).toBeInTheDocument();
    expect(within(accountSection).getAllByText("FreshRSS").length).toBeGreaterThan(0);
    expect(within(accountSection).getByText("debug")).toBeInTheDocument();
    expect(within(accountSection).getByRole("button", { name: "アカウントを追加..." })).toBeInTheDocument();

    expect(screen.getByText("Folder stack")).toBeInTheDocument();
    expect(screen.getByText("Interior")).toBeInTheDocument();
    expect(screen.getByText("99% DIY -DIYブログ-")).toBeInTheDocument();
    expect(screen.getByText("CAFICT")).toBeInTheDocument();
    expect(screen.getByText("Tag palette")).toBeInTheDocument();
    expect(screen.getByText("カラー")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "色なし" })).toBeInTheDocument();
  });

  it("renders the workspace patterns canvas with composition specimens", () => {
    render(<ViewSpecimensCanvas />);

    expect(screen.getByText("View specimens")).toBeInTheDocument();
    expect(screen.getByTestId("reference-workspace-filter-cluster-frame")).toHaveClass("rounded-md");
    expect(screen.getByRole("button", { name: "すべて163" })).toHaveClass("rounded-md");
    expect(within(screen.getByRole("button", { name: "すべて163" })).getByText("163")).toHaveClass("rounded-sm");
    expect(screen.getByText("Summary filter cards")).toBeInTheDocument();
    expect(screen.getByText("Short numeric swaps")).toBeInTheDocument();
    expect(screen.getByTestId("reference-motion-number-frame")).toHaveClass("rounded-md");
    const motionNumberFrame = screen.getByTestId("reference-motion-number-frame");
    const motionNumber = motionNumberFrame.querySelector(".t-digit-group");
    if (!motionNumber) {
      throw new Error("Motion number specimen did not render a digit group");
    }
    expect(motionNumber).toHaveClass("t-digit-group", "tabular-nums");
    expect(within(motionNumberFrame).getByRole("button", { name: "未読なし163" })).toBeInTheDocument();
    const chipMotionNumber = within(motionNumberFrame)
      .getByRole("button", { name: "未読なし163" })
      .querySelector(".t-digit-group");
    if (!chipMotionNumber) {
      throw new Error("Motion number chip specimen did not render a digit group");
    }
    expect(chipMotionNumber).toHaveClass("t-digit-group", "tabular-nums");
    expect(screen.getByTestId("reference-summary-filter-card-frame")).toBeInTheDocument();
    expect(screen.getByTestId("reference-summary-filter-card-frame").querySelectorAll(".t-digit-group")).toHaveLength(
      3,
    );
    expect(
      within(screen.getByTestId("reference-summary-filter-card-frame")).getByRole("button", { name: /確認待ち/ }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(
      within(screen.getByTestId("reference-summary-filter-card-frame")).queryByRole("button", { name: /同期状態/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("同期状態").closest("[data-subscriptions-summary-static-card]")).toHaveClass("rounded-md");
    expect(screen.getByText("参照")).toBeInTheDocument();
    expect(screen.getByText("Subscription group disclosure")).toBeInTheDocument();
    expect(screen.getByTestId("reference-subscription-group-disclosure-frame")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Design2" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "フォルダなし1" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByTestId("reference-workspace-action-cluster")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Keep selected" })).toHaveClass("rounded-md", "min-w-[7.5rem]");
    expect(screen.getByRole("button", { name: "Defer selected" })).toHaveClass("rounded-md", "min-w-[7.5rem]");
    expect(screen.getByRole("button", { name: "Delete selected" })).toHaveClass("rounded-md", "min-w-[7.5rem]");
    expect(screen.getByTestId("reference-detail-panel-frame")).toBeInTheDocument();
    expect(screen.getByTestId("reference-settings-header-summary-frame")).toBeInTheDocument();
    expect(screen.getByText("Settings header summary")).toBeInTheDocument();
    expect(screen.getAllByText("確認済み").length).toBeGreaterThan(0);
    expect(screen.getAllByText("AUTOMATON").length).toBeGreaterThan(0);
    expect(screen.getByTestId("reference-workspace-two-pane-frame")).toHaveClass("rounded-md");
    expect(screen.getByTestId("reference-workspace-two-pane-detail")).toHaveClass("motion-content-swap");
    expect(screen.getByText("Announcement cards")).toBeInTheDocument();
    expect(screen.getAllByText("確認待ち").length).toBeGreaterThan(0);
    expect(screen.getByText("判断済み")).toBeInTheDocument();
    expect(screen.getByTestId("reference-announcement-card-pending")).toHaveClass("shadow-none");
    expect(
      within(screen.getByTestId("reference-announcement-card-pending")).queryByRole("button", { name: /確認待ち/ }),
    ).not.toBeInTheDocument();
  });

  it("lets the workspace two-pane specimen swap selected detail content", async () => {
    const user = userEvent.setup();
    render(<ViewSpecimensCanvas />);

    const detail = screen.getByTestId("reference-workspace-two-pane-detail");
    expect(within(detail).getByRole("heading", { name: "AUTOMATON" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Publickey/ }));

    const swappedDetail = screen.getByTestId("reference-workspace-two-pane-detail");
    expect(swappedDetail).toHaveClass("motion-content-swap");
    expect(swappedDetail).toHaveAttribute("data-motion-phase", "entering");
    expect(within(swappedDetail).getByRole("heading", { name: "Publickey" })).toBeInTheDocument();
    expect(within(swappedDetail).getByText("Engineering")).toBeInTheDocument();
  });

  it("renders the settings workspace canvas with real settings shell composition", () => {
    render(<SettingsWorkspaceCanvas />);

    expect(screen.getByText("Settings workspace")).toBeInTheDocument();
    expect(screen.getByTestId("reference-settings-workspace-detail-shell")).toHaveClass("rounded-xl");
    expect(screen.getByTestId("reference-settings-workspace-add-shell")).toHaveClass("rounded-xl");
    expect(screen.getAllByText("Settings").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Accounts").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Debug").length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { level: 2, name: "Debug" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "FreshRSS" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Add account…" }).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Add" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });
});
