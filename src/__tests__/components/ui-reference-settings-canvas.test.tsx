import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ButtonControlsCanvas } from "@/components/storybook/ui-reference-button-controls-canvas.stories";
import * as controlSpecimens from "@/components/storybook/ui-reference-control-specimens";
import * as foundationSpecimens from "@/components/storybook/ui-reference-foundation-specimens";
import { SurfaceRoleSpecimen } from "@/components/storybook/ui-reference-foundation-specimens";
import { FoundationsCanvas } from "@/components/storybook/ui-reference-foundations-canvas.stories";
import { NavigationCollectionsCanvas } from "@/components/storybook/ui-reference-navigation-collections-canvas.stories";
import * as navigationSpecimens from "@/components/storybook/ui-reference-navigation-specimens";
import { AccountCardStackSpecimen } from "@/components/storybook/ui-reference-navigation-specimens";
import { InputControlsCanvas } from "@/components/storybook/ui-reference-settings-canvas.stories";
import * as settingsSpecimens from "@/components/storybook/ui-reference-settings-specimens";
import { SettingsWorkspaceCanvas } from "@/components/storybook/ui-reference-settings-workspace-canvas.stories";
import { ShellOverlayCanvas } from "@/components/storybook/ui-reference-shell-overlay-canvas.stories";
import * as shellSpecimens from "@/components/storybook/ui-reference-shell-specimens";
import {
  CommandPaletteShellSpecimen,
  MotionTransitionsSpecimen,
  ShellExamplesSpecimen,
} from "@/components/storybook/ui-reference-shell-specimens";
import { ViewSpecimensCanvas } from "@/components/storybook/ui-reference-workspace-patterns-canvas.stories";
import * as workspaceSpecimens from "@/components/storybook/ui-reference-workspace-specimens";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { AppTooltip, TooltipProvider } from "@/components/ui/tooltip";
import i18n from "@/lib/i18n";

const UI_COMPONENTS_DIR = resolve(process.cwd(), "src/components/ui");

const settingsCanvasLocaleSmokeCases = [
  {
    language: "en",
    accountHeading: "Account",
    serverUrlLabel: "Server URL",
    submitLabel: "Add",
    cancelLabel: "Cancel",
  },
  {
    language: "ja",
    accountHeading: "アカウント",
    serverUrlLabel: "サーバーURL",
    submitLabel: "追加",
    cancelLabel: "キャンセル",
  },
] as const;

describe("UI Reference canvases", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
    vi.stubGlobal(
      "ResizeObserver",
      class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("keeps storybook specimen exports split by canvas category", () => {
    expect(foundationSpecimens).toHaveProperty("TypographyScaleSpecimen");
    expect(controlSpecimens).toHaveProperty("ButtonFamilyGuideSpecimen");
    expect(workspaceSpecimens).toHaveProperty("WorkspaceTwoPaneSpecimen");
    expect(settingsSpecimens).toHaveProperty("SettingsHeaderSummarySpecimen");
    expect(navigationSpecimens).toHaveProperty("NavigationStackSpecimen");
    expect(shellSpecimens).toHaveProperty("ShellExamplesSpecimen");
  });

  it("uses typographic ellipsis in legacy reference specimens", () => {
    render(
      <>
        <AccountCardStackSpecimen />
        <CommandPaletteShellSpecimen />
        <MotionTransitionsSpecimen />
      </>,
    );

    expect(screen.getByRole("button", { name: "アカウントを追加…" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Search reader actions…")).toBeInTheDocument();
    expect(screen.getByText("Edit…")).toBeInTheDocument();
    expect(screen.queryByText("アカウントを追加...")).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Search reader actions...")).not.toBeInTheDocument();
    expect(screen.queryByText("Edit...")).not.toBeInTheDocument();
  });

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

    const lightStrip = within(screen.getByTestId("reference-reader-header-action-strip"));
    const readButton = lightStrip.getByRole("button", { name: "Toggle read" });
    const starButton = lightStrip.getByRole("button", { name: "Toggle star" });
    const previewButton = lightStrip.getByRole("button", { name: "Open Web Preview" });

    expect(readButton).toHaveAttribute("aria-pressed", "false");
    expect(starButton).toHaveAttribute("aria-pressed", "true");
    expect(previewButton).toHaveAttribute("aria-pressed", "false");

    await user.click(readButton);
    await user.click(starButton);
    await user.click(previewButton);

    expect(readButton).toHaveAttribute("aria-pressed", "true");
    expect(starButton).toHaveAttribute("aria-pressed", "false");
    expect(
      lightStrip.getByRole("button", {
        name: "Close Web Preview",
      }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("renders the reader header action strip dark compact reference from the shared toolbar control", async () => {
    const user = userEvent.setup();
    render(<ButtonControlsCanvas />);

    const darkStripElement = screen.getByTestId("reference-reader-header-action-strip-dark");
    const darkStrip = within(darkStripElement);
    const readButton = darkStrip.getByRole("button", { name: "Toggle read" });
    const starButton = darkStrip.getByRole("button", { name: "Toggle star" });
    const previewButton = darkStrip.getByRole("button", { name: "Close Web Preview" });

    expect(darkStripElement).toHaveClass("dark", "bg-[#191712]");
    expect(darkStripElement).toHaveStyle("--primary: #f54e00");
    expect(darkStripElement).toHaveStyle("--ring: rgba(245, 78, 0, 0.38)");
    expect(readButton).toHaveAttribute("aria-pressed", "false");
    expect(starButton).toHaveAttribute("aria-pressed", "true");
    expect(previewButton).toHaveAttribute("aria-pressed", "true");

    await user.click(readButton);
    await user.click(starButton);
    await user.click(previewButton);

    expect(readButton).toHaveAttribute("aria-pressed", "true");
    expect(starButton).toHaveAttribute("aria-pressed", "false");
    expect(darkStrip.getByRole("button", { name: "Open Web Preview" })).toHaveAttribute("aria-pressed", "false");
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
    expect(screen.getByRole("textbox", { name: "Feed URL" })).toHaveClass("pr-20");
    expect(screen.getByRole("button", { name: "Discover feed" })).toHaveClass("absolute", "right-1", "h-7", "min-w-14");
    expect(screen.getByRole("combobox", { name: "Density" })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Live Preview" })).toBeInTheDocument();

    expect(screen.getByText("Primitive control states")).toBeInTheDocument();
    expect(screen.getByTestId("reference-primitive-control-matrix")).toHaveClass("rounded-md");
    expect(screen.getByRole("textbox", { name: "Primitive input default" })).toHaveClass(
      "bg-surface-1",
      "border-border",
    );
    expect(screen.getByRole("textbox", { name: "Primitive input invalid" })).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("textbox", { name: "Primitive input disabled" })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "Primitive select default" })).toHaveTextContent("Comfortable");
    expect(screen.getByRole("combobox", { name: "Primitive select invalid" })).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("combobox", { name: "Primitive select disabled" })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "Primitive checkbox checked" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("checkbox", { name: "Primitive checkbox disabled" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByRole("switch", { name: "Primitive switch checked" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("switch", { name: "Primitive switch disabled" })).toHaveAttribute("aria-disabled", "true");

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

  it("smoke-renders UI reference settings canvases in English and Japanese locales", async () => {
    for (const localeCase of settingsCanvasLocaleSmokeCases) {
      await i18n.changeLanguage(localeCase.language);

      const inputControlsRender = render(<InputControlsCanvas />);
      expect(screen.getByRole("textbox", { name: "Display name" })).toHaveClass("h-10", "flex-1");
      expect(screen.getByRole("button", { name: "Discover feed" })).toHaveClass(
        "absolute",
        "right-1",
        "h-7",
        "min-w-14",
      );
      inputControlsRender.unmount();

      const settingsWorkspaceRender = render(<SettingsWorkspaceCanvas />);
      const addAccountShell = screen.getByTestId("reference-settings-workspace-add-shell");
      expect(addAccountShell.querySelector(".flex-wrap")).toBeInTheDocument();
      expect(within(addAccountShell).getByRole("heading", { name: localeCase.accountHeading })).toBeInTheDocument();
      expect(within(addAccountShell).getByRole("textbox", { name: localeCase.serverUrlLabel })).toHaveClass("h-10");
      expect(within(addAccountShell).getByRole("button", { name: localeCase.cancelLabel })).toHaveClass("min-h-11");
      expect(within(addAccountShell).getByRole("button", { name: localeCase.submitLabel })).toHaveClass("min-h-11");
      settingsWorkspaceRender.unmount();
    }
  });

  it("keeps Base UI wrapper data-slot contracts by primitive", async () => {
    const user = userEvent.setup();
    const primitiveRender = render(
      <TooltipProvider>
        <div>
          <Button disabled>Disabled button</Button>
          <Button nativeButton={false} render={<a href="/reference">Anchor button</a>}>
            Anchor button
          </Button>
          <Select defaultValue="Comfortable">
            <SelectTrigger aria-label="Contract select">
              <SelectValue />
            </SelectTrigger>
            <SelectPopup>
              <SelectItem value="Comfortable">Comfortable</SelectItem>
            </SelectPopup>
          </Select>
          <AppTooltip label="Tooltip contract">
            <Button>Tooltip target</Button>
          </AppTooltip>
          <ScrollArea className="h-20" contentClassName="min-h-24">
            Scroll content
          </ScrollArea>
          <Skeleton />
        </div>
      </TooltipProvider>,
    );
    const { container } = primitiveRender;

    expect(screen.getByRole("button", { name: "Disabled button" })).toHaveAttribute("data-slot", "button");
    expect(screen.getByRole("button", { name: "Disabled button" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Anchor button" })).toHaveAttribute("data-slot", "button");
    expect(screen.getByRole("button", { name: "Anchor button" }).tagName).toBe("A");
    expect(screen.getByRole("combobox", { name: "Contract select" })).toHaveAttribute("data-slot", "select-trigger");
    expect(screen.getByText("Comfortable")).toHaveAttribute("data-slot", "select-value");
    expect(container.querySelector('[data-slot="select-icon"]')).toBeInTheDocument();
    expect(container.querySelector('[data-slot="scroll-area"]')).toBeInTheDocument();
    expect(container.querySelector('[data-slot="scroll-area-viewport"]')).toBeInTheDocument();
    expect(container.querySelector('[data-slot="scroll-area-content"]')).toBeInTheDocument();
    expect(container.querySelector('[data-slot="skeleton"]')).toBeInTheDocument();
    const scrollAreaSource = readFileSync(resolve(UI_COMPONENTS_DIR, "scroll-area.tsx"), "utf8");
    expect(scrollAreaSource).toContain('data-slot="scroll-area-scrollbar"');
    expect(scrollAreaSource).toContain('data-slot="scroll-area-thumb"');

    await user.hover(screen.getByRole("button", { name: "Tooltip target" }));

    await waitFor(() => {
      expect(document.querySelector('[data-slot="tooltip-popup"]')).toHaveTextContent("Tooltip contract");
    });

    primitiveRender.unmount();
    render(
      <Dialog open>
        <DialogContent closeLabel="Close contract dialog">
          <DialogHeader>
            <DialogTitle>Contract dialog</DialogTitle>
            <DialogDescription>Dialog content slot contract</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>,
    );

    expect(document.querySelector('[data-slot="dialog-overlay"]')).toBeInTheDocument();
    expect(document.querySelector('[data-slot="dialog-content"]')).toBeInTheDocument();
    expect(document.querySelector('[data-slot="dialog-title"]')).toBeInTheDocument();
    expect(document.querySelector('[data-slot="dialog-description"]')).toBeInTheDocument();
    expect(document.querySelector('[data-slot="dialog-footer"]')).toBeInTheDocument();
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
    const utilityChrome = screen.getByTestId("reference-utility-action-chrome-strip");
    expect(utilityChrome).toHaveClass(
      "bg-[color-mix(in_srgb,var(--foreground)_86%,var(--background))]",
      "text-[color:var(--background)]",
    );
    expect(within(utilityChrome).getByRole("button", { name: "Refresh" })).toHaveClass(
      "hover:bg-[color-mix(in_srgb,var(--foreground)_78%,var(--background))]",
      "hover:text-[color:var(--background)]",
    );
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

    const commandShell = screen.getByTestId("reference-command-palette-shell");
    expect(commandShell).toHaveClass("rounded-md");
    expect(within(commandShell).getByText("Command palette shell")).toBeInTheDocument();
    expect(within(commandShell).getByPlaceholderText("Search reader actions…")).toHaveAttribute(
      "aria-label",
      "Reference command search",
    );
    expect(commandShell.querySelector("[data-slot='command']")).toBeInTheDocument();
    expect(commandShell.querySelector("[data-slot='command-list']")).toBeInTheDocument();
    expect(within(commandShell).getByText("Sync all feeds")).toBeInTheDocument();
    expect(within(commandShell).getByText("Open settings")).toBeInTheDocument();
    expect(within(commandShell).getByText("⌘R")).toBeInTheDocument();
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
    expect(screen.getByTestId("reference-account-article-nav-alignment")).toBeInTheDocument();
    expect(screen.getByTestId("reference-account-card-frame")).toHaveClass("rounded-md");
    expect(screen.getByTestId("reference-folder-stack-frame")).toHaveClass("rounded-md");

    const filterGroup = screen.getByRole("group", { name: "記事フィルター" });
    expect(within(filterGroup).getByRole("button", { name: "未読" })).toBeInTheDocument();
    expect(within(filterGroup).getByRole("button", { name: "すべて" })).toBeInTheDocument();
    expect(within(filterGroup).getByRole("button", { name: "スター" })).toBeInTheDocument();
    expect(within(filterGroup).getByRole("button", { name: "すべて" })).toHaveClass(
      "data-[pressed]:bg-[var(--sidebar-pressed-surface)]",
    );

    const accountSection = screen.getByTestId("reference-account-card-frame");
    const activeAccountButton = within(accountSection).getByRole("button", { name: "FreshRSS jey3dayo" });
    expect(activeAccountButton).toHaveClass(
      "before:left-0",
      "before:w-0.5",
      "before:bg-border-strong/70",
      "before:opacity-70",
    );
    expect(within(accountSection).getAllByText("FreshRSS").length).toBeGreaterThan(0);
    expect(within(accountSection).getByText("debug")).toBeInTheDocument();
    expect(within(accountSection).getByRole("button", { name: "アカウントを追加…" })).toBeInTheDocument();

    const alignmentSection = screen.getByTestId("reference-account-article-nav-alignment");
    const unreadSmartView = within(alignmentSection).getByRole("button", { name: "未読1,988" });
    expect(unreadSmartView).toHaveClass("bg-[var(--semantic-tone-unread-surface)]");
    expect(unreadSmartView).not.toHaveClass("before:bg-primary/85");

    expect(screen.getByText("Folder stack")).toBeInTheDocument();
    expect(screen.getByText("Interior")).toBeInTheDocument();
    expect(screen.getByText("99% DIY -DIYブログ-")).toBeInTheDocument();
    expect(screen.getByText("CAFICT")).toBeInTheDocument();
    expect(screen.getByText("Primitive collection states")).toBeInTheDocument();
    const primitiveCollections = screen.getByTestId("reference-primitive-collection-states");
    expect(primitiveCollections).toHaveClass("rounded-md");
    expect(primitiveCollections.querySelector("[data-slot='scroll-area']")).toBeInTheDocument();
    expect(primitiveCollections.querySelectorAll("[data-slot='skeleton']")).toHaveLength(3);
    expect(screen.getByRole("button", { name: "Primitive disclosure open" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "Tooltip target" })).toBeInTheDocument();
    expect(screen.getByText("Tag palette")).toBeInTheDocument();
    expect(screen.getByText("カラー")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "色なし" })).toBeInTheDocument();
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
    expect(screen.queryByTestId("reference-settings-header-summary-frame")).not.toBeInTheDocument();
    expect(screen.queryByText("Settings header summary")).not.toBeInTheDocument();
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
    expect(screen.getByText("Settings header summary")).toBeInTheDocument();
    expect(screen.getByTestId("reference-settings-header-summary-frame")).toBeInTheDocument();
    expect(screen.getAllByText("確認済み").length).toBeGreaterThan(0);
    expect(screen.getByTestId("reference-settings-workspace-detail-shell")).toHaveClass("rounded-xl");
    expect(screen.getByTestId("reference-settings-workspace-add-shell")).toHaveClass("rounded-xl");
    expect(screen.getAllByText("Settings").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Accounts").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Debug").length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { level: 2, name: "Debug" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "FreshRSS" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Add account…" }).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Test Connection" })).toHaveClass(
      "border",
      "border-border/65",
      "bg-surface-2/82",
      "text-foreground",
    );
    expect(screen.getByRole("button", { name: "Add" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });
});
