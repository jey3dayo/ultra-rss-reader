import { render, screen, within } from "@testing-library/react";
import { resetTauriRuntimeFlags, setTauriRuntimePresent } from "@tests/helpers/tauri-runtime";
import { afterEach, describe, expect, it } from "vitest";
import { ArticleFilterToggleButton } from "@/components/shared/article-filter-toggle-button";
import { ControlChipButton } from "@/components/shared/control-chip-button";
import { GradientSwitch } from "@/components/shared/gradient-switch";
import { LabelChip } from "@/components/shared/label-chip";
import { NavRowButton } from "@/components/shared/nav-row-button";
import { SectionHeading } from "@/components/shared/section-heading";
import { WorkspaceHeader } from "@/components/shared/workspace-header";
import { Switch } from "@/components/ui/switch";
import { usePlatformStore } from "@/stores/platform-store";

describe("Design-themed shared components", () => {
  afterEach(() => {
    resetTauriRuntimeFlags();
    usePlatformStore.setState({
      platform: {
        kind: "unknown",
        capabilities: {
          supports_reading_list: false,
          supports_background_browser_open: false,
          supports_runtime_window_icon_replacement: false,
          supports_native_browser_navigation: false,
          uses_dev_file_credentials: false,
        },
      },
      loaded: false,
      loadError: false,
      inFlightLoad: null,
    });
  });

  it("reserves space for mac traffic lights before platform info resolves", () => {
    const originalPlatform = window.navigator.platform;
    setTauriRuntimePresent();
    Object.defineProperty(window.navigator, "platform", {
      configurable: true,
      value: "MacIntel",
    });

    usePlatformStore.setState({
      platform: {
        kind: "unknown",
        capabilities: {
          supports_reading_list: false,
          supports_background_browser_open: false,
          supports_runtime_window_icon_replacement: false,
          supports_native_browser_navigation: false,
          uses_dev_file_credentials: false,
        },
      },
      loaded: false,
      loadError: false,
      inFlightLoad: null,
    });

    render(
      <WorkspaceHeader
        eyebrow="Workspace"
        title="購読一覧"
        subtitle="subtitle"
        backLabel="戻る"
        onBack={() => {}}
        closeLabel="閉じる"
        onClose={() => {}}
      />,
    );

    expect(screen.getByTestId("workspace-header-body").parentElement).toHaveStyle({
      backgroundColor: "var(--workspace-header-surface)",
    });
    expect(screen.getByTestId("workspace-header-drag-region")).toHaveAttribute("data-tauri-drag-region");

    Object.defineProperty(window.navigator, "platform", {
      configurable: true,
      value: originalPlatform,
    });
  });

  it("applies warm editorial styling to section headings", () => {
    render(<SectionHeading>Appearance</SectionHeading>);

    expect(screen.getByRole("heading", { level: 3, name: "Appearance" })).toHaveClass(
      "text-[color:var(--section-heading-color)]",
    );
  });

  it("uses layered surfaces for navigation rows and chips", () => {
    render(
      <>
        <NavRowButton title="General settings" />
        <ControlChipButton pressed>Unread</ControlChipButton>
        <GradientSwitch checked={true} aria-label="Live preview" />
        <LabelChip tone="muted">Muted chip</LabelChip>
        <LabelChip>Neutral chip</LabelChip>
        <LabelChip tone="success" size="compact">
          Success chip
        </LabelChip>
        <LabelChip tone="warning">Warning chip</LabelChip>
        <LabelChip tone="danger">Danger chip</LabelChip>
      </>,
    );

    expect(screen.getByRole("button", { name: "General settings" })).toHaveClass(
      "motion-interactive-surface",
      "motion-contextual-surface",
      "select-none",
      "hover:bg-surface-2",
    );
    expect(screen.getByRole("button", { name: "Unread" })).toHaveClass(
      "motion-interactive-surface",
      "motion-contextual-surface",
      "select-none",
      "motion-reduce:transition-none",
      "bg-surface-2/88",
      "border-border/70",
      "data-[pressed]:bg-surface-4",
      "data-[pressed]:border-border-strong",
      "data-[pressed]:shadow-[var(--control-chip-pressed-shadow)]",
    );
    expect(screen.getByRole("switch", { name: "Live preview" })).toHaveClass(
      "bg-[linear-gradient(to_right,var(--gradient-switch-track-on)_35%,var(--gradient-switch-track-off)_65%)]",
    );
    expect(screen.getByRole("switch", { name: "Live preview" })).toHaveClass(
      "shadow-[var(--gradient-switch-track-shadow)]",
      "motion-reduce:transition-none",
    );
    expect(screen.getByText("Muted chip")).toHaveAttribute("data-label-chip", "muted");
    expect(screen.getByText("Muted chip")).toHaveClass("text-foreground-soft", "motion-reduce:transition-none");
    expect(screen.getByText("Neutral chip")).toHaveAttribute("data-label-chip", "neutral");
    expect(screen.getByText("Success chip")).toHaveClass(
      "border-state-success-border",
      "bg-state-success-surface",
      "text-state-success-foreground",
      "px-2",
      "py-0.5",
    );
    expect(screen.getByText("Warning chip")).toHaveClass(
      "border-state-warning-border",
      "bg-state-warning-surface",
      "text-state-warning-foreground",
    );
    expect(screen.getByText("Danger chip")).toHaveClass(
      "border-state-danger-border",
      "bg-state-danger-surface",
      "text-state-danger-foreground",
    );
  });

  it("keeps base switch transitions explicit", () => {
    render(<Switch aria-label="Base switch" />);

    const switchControl = screen.getByRole("switch", { name: "Base switch" });
    expect(switchControl).toHaveClass("transition-[color,background-color,border-color,box-shadow,opacity]");
    expect(switchControl).not.toHaveClass("transition-all");
    expect(switchControl.querySelector("[data-slot='switch-thumb']")).toHaveClass("transition-transform");
  });

  it("centralizes colored article filter toggle buttons", () => {
    render(
      <>
        <ArticleFilterToggleButton mode="unread" pressed value="unread" aria-label="Unread">
          Unread
        </ArticleFilterToggleButton>
        <ArticleFilterToggleButton mode="starred" pressed value="starred" aria-label="Starred">
          Starred
        </ArticleFilterToggleButton>
      </>,
    );

    expect(screen.getByRole("button", { name: "Unread" })).toHaveClass(
      "data-[pressed]:bg-[var(--semantic-tone-unread-surface)]",
      "data-[pressed]:text-[var(--semantic-tone-unread-content-foreground)]",
    );
    expect(screen.getByRole("button", { name: "Starred" })).toHaveClass(
      "data-[pressed]:bg-[var(--semantic-tone-starred-surface)]",
      "data-[pressed]:text-[var(--semantic-tone-starred-content-foreground)]",
    );
  });

  it("reserves space for mac traffic lights in workspace headers", () => {
    setTauriRuntimePresent();
    usePlatformStore.setState({
      platform: {
        kind: "macos",
        capabilities: {
          supports_reading_list: false,
          supports_background_browser_open: false,
          supports_runtime_window_icon_replacement: true,
          supports_native_browser_navigation: true,
          uses_dev_file_credentials: false,
        },
      },
      loaded: true,
      loadError: false,
      inFlightLoad: null,
    });

    render(
      <WorkspaceHeader
        eyebrow="Workspace"
        title="購読一覧"
        subtitle="subtitle"
        backLabel="戻る"
        onBack={() => {}}
        closeLabel="閉じる"
        onClose={() => {}}
      />,
    );

    const backButton = screen.getByRole("button", { name: "戻る" });
    const closeButton = screen.getByRole("button", { name: "閉じる" });
    const titleGroup = screen.getByTestId("workspace-header-title-group");
    const topDragRegion = screen.getByTestId("workspace-header-top-row-drag-region");
    const titleGroupDragRegion = screen.getByTestId("workspace-header-title-group-drag-region");
    const topRow = screen.getByTestId("workspace-header-top-row");

    expect(backButton).toHaveStyle({
      backgroundColor: "var(--workspace-header-action-surface)",
    });
    expect(screen.getByTestId("workspace-header-drag-region")).toHaveAttribute("data-tauri-drag-region");
    expect(screen.getByTestId("workspace-header-drag-region")).toHaveStyle({
      width: "72px",
    });
    expect(backButton).not.toHaveClass("rounded-full");
    expect(backButton).toHaveAttribute("aria-label", "戻る");
    expect(within(titleGroup).getByRole("button", { name: "戻る" })).toBeInTheDocument();
    expect(topRow).not.toHaveClass("absolute");
    expect(topDragRegion).toHaveAttribute("data-tauri-drag-region");
    expect(titleGroupDragRegion).toHaveAttribute("data-tauri-drag-region");
    expect(topDragRegion).not.toContainElement(closeButton);
    expect(titleGroupDragRegion).not.toContainElement(backButton);
  });

  it("moves desktop back navigation into the title row", () => {
    setTauriRuntimePresent();
    usePlatformStore.setState({
      platform: {
        kind: "macos",
        capabilities: {
          supports_reading_list: false,
          supports_background_browser_open: false,
          supports_runtime_window_icon_replacement: true,
          supports_native_browser_navigation: true,
          uses_dev_file_credentials: false,
        },
      },
      loaded: true,
      loadError: false,
      inFlightLoad: null,
    });

    render(
      <WorkspaceHeader
        eyebrow="Workspace"
        title="購読一覧"
        subtitle="subtitle"
        backLabel="戻る"
        onBack={() => {}}
        closeLabel="閉じる"
        onClose={() => {}}
      />,
    );

    const titleGroup = screen.getByTestId("workspace-header-title-group");
    const actionsRow = screen.getByTestId("workspace-header-actions");
    const topRow = screen.getByTestId("workspace-header-top-row");
    const navigationRow = screen.getByTestId("workspace-header-navigation-row");

    expect(within(actionsRow).getByRole("button", { name: "閉じる" })).toBeInTheDocument();
    expect(within(titleGroup).getByText("Workspace")).toBeInTheDocument();
    expect(within(topRow).queryByRole("button", { name: "戻る" })).toBeNull();
    expect(within(navigationRow).getByRole("button", { name: "戻る" })).toBeInTheDocument();
    expect(within(titleGroup).getByRole("heading", { name: "購読一覧" })).toBeInTheDocument();
  });

  it("offsets the desktop workspace title group away from the mac drag region", () => {
    setTauriRuntimePresent();
    usePlatformStore.setState({
      platform: {
        kind: "macos",
        capabilities: {
          supports_reading_list: false,
          supports_background_browser_open: false,
          supports_runtime_window_icon_replacement: true,
          supports_native_browser_navigation: true,
          uses_dev_file_credentials: false,
        },
      },
      loaded: true,
      loadError: false,
      inFlightLoad: null,
    });

    render(
      <WorkspaceHeader
        eyebrow="Workspace"
        title="購読一覧"
        subtitle="subtitle"
        backLabel="戻る"
        onBack={() => {}}
        closeLabel="閉じる"
        onClose={() => {}}
      />,
    );

    expect(screen.getByTestId("workspace-header-title-group")).toHaveStyle({
      paddingLeft: "24px",
    });
  });

  it("keeps the standard horizontal padding on windows without a mac titlebar offset", () => {
    setTauriRuntimePresent();
    usePlatformStore.setState({
      platform: {
        kind: "windows",
        capabilities: {
          supports_reading_list: false,
          supports_background_browser_open: false,
          supports_runtime_window_icon_replacement: true,
          supports_native_browser_navigation: true,
          uses_dev_file_credentials: false,
        },
      },
      loaded: true,
      loadError: false,
      inFlightLoad: null,
    });

    render(
      <WorkspaceHeader
        eyebrow="Workspace"
        title="購読一覧"
        subtitle="subtitle"
        backLabel="戻る"
        onBack={() => {}}
        closeLabel="閉じる"
        onClose={() => {}}
      />,
    );

    const headerRoot = screen.getByTestId("workspace-header-body").parentElement;
    const topRow = screen.getByTestId("workspace-header-top-row");
    const titleGroup = screen.getByTestId("workspace-header-title-group");

    expect(headerRoot).toHaveClass("py-1.5");
    expect(screen.queryByTestId("workspace-header-drag-region")).toBeNull();
    expect(screen.getByTestId("workspace-header-navigation-row")).toBeInTheDocument();
    expect(within(topRow).getByText("Workspace")).toBeInTheDocument();
    expect(within(titleGroup).queryByText("Workspace")).toBeNull();
  });

  it("shows the eyebrow inline with the back action in browser preview mode", () => {
    render(
      <WorkspaceHeader
        eyebrow="Workspace"
        title="購読一覧"
        subtitle="subtitle"
        backLabel="戻る"
        onBack={() => {}}
        closeLabel="閉じる"
        onClose={() => {}}
      />,
    );

    const topRow = screen.getByTestId("workspace-header-top-row");
    const titleGroup = screen.getByTestId("workspace-header-title-group");

    expect(within(topRow).getByRole("button", { name: "戻る" })).toBeInTheDocument();
    expect(within(topRow).getByText("Workspace")).toHaveClass("motion-content-swap");
    expect(within(titleGroup).queryByText("Workspace")).toBeNull();
    expect(screen.queryByTestId("workspace-header-navigation-row")).toBeNull();
    expect(screen.getByRole("heading", { name: "購読一覧" })).toHaveClass("motion-content-swap");
  });
});
