import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ControlChipButton } from "@/components/shared/control-chip-button";
import { NavRowButton } from "@/components/shared/nav-row-button";
import { SectionHeading } from "@/components/shared/section-heading";
import { WorkspaceHeader } from "@/components/shared/workspace-header";
import { usePlatformStore } from "@/stores/platform-store";

describe("Design-themed shared components", () => {
  afterEach(() => {
    delete window.__TAURI_INTERNALS__;
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
    window.__TAURI_INTERNALS__ = {} as typeof window.__TAURI_INTERNALS__;
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
    expect(screen.getByTestId("workspace-header-leading")).toHaveStyle({
      marginLeft: "52px",
    });

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
      </>,
    );

    expect(screen.getByRole("button", { name: "General settings" })).toHaveClass("hover:bg-surface-2");
    expect(screen.getByRole("button", { name: "Unread" })).toHaveClass(
      "bg-surface-2/88",
      "border-border/70",
      "data-[pressed]:bg-surface-4",
      "data-[pressed]:border-border-strong",
    );
  });

  it("reserves space for mac traffic lights in workspace headers", () => {
    window.__TAURI_INTERNALS__ = {} as typeof window.__TAURI_INTERNALS__;
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

    expect(backButton).toHaveStyle({
      backgroundColor: "var(--workspace-header-action-surface)",
    });
    expect(screen.getByTestId("workspace-header-leading")).toHaveStyle({
      marginLeft: "52px",
    });
    expect(screen.getByTestId("workspace-header-drag-region")).toHaveAttribute("data-tauri-drag-region");
    expect(screen.getByTestId("workspace-header-drag-region")).toHaveStyle({
      width: "72px",
    });
    expect(backButton).not.toHaveClass("rounded-full");
    expect(backButton).toHaveAttribute("aria-label", "戻る");
  });

  it("separates the top action row from the heading section", () => {
    window.__TAURI_INTERNALS__ = {} as typeof window.__TAURI_INTERNALS__;
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

    expect(within(actionsRow).getByRole("button", { name: "閉じる" })).toBeInTheDocument();
    expect(within(topRow).getByRole("button", { name: "戻る" })).toBeInTheDocument();
    expect(within(titleGroup).getByText("Workspace")).toBeInTheDocument();
    expect(within(topRow).queryByText("Workspace")).toBeNull();
    expect(within(titleGroup).getByRole("heading", { name: "購読一覧" })).toBeInTheDocument();
  });

  it("keeps the standard horizontal padding on windows without a mac titlebar offset", () => {
    window.__TAURI_INTERNALS__ = {} as typeof window.__TAURI_INTERNALS__;
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

    expect(screen.getByTestId("workspace-header-leading")).not.toHaveStyle({
      marginLeft: "52px",
    });
    expect(screen.queryByTestId("workspace-header-drag-region")).toBeNull();
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
    expect(within(topRow).getByText("Workspace")).toBeInTheDocument();
    expect(within(titleGroup).queryByText("Workspace")).toBeNull();
  });
});
