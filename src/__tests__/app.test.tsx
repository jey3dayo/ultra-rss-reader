import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { AppLayout } from "@/components/app-layout";
import { shouldUseDesktopOverlayTitlebar } from "@/lib/window-chrome";
import { useUiStore } from "@/stores/ui-store";
import { createWrapper } from "../../tests/helpers/create-wrapper";
import { setupTauriMocks } from "../../tests/helpers/tauri-mocks";

describe("App", () => {
  beforeEach(() => {
    useUiStore.setState(useUiStore.getInitialState());
    setupTauriMocks();
  });

  it("mobile: renders sliding layout with all panes and correct inert/aria-hidden", () => {
    useUiStore.setState({ layoutMode: "mobile", focusedPane: "sidebar" });

    const { container, rerender } = render(<AppLayout />, { wrapper: createWrapper() });

    const tray = container.firstElementChild?.firstElementChild;
    expect(tray).toHaveClass("w-[300%]");

    // sidebar focused: sidebar visible, list and content hidden
    const panes = tray?.children;
    expect(panes).toHaveLength(3);
    expect(panes?.[0]).not.toHaveAttribute("inert");
    expect(panes?.[1]).toHaveAttribute("inert");
    expect(panes?.[2]).toHaveAttribute("inert");

    // Switch to list
    useUiStore.setState({ layoutMode: "mobile", focusedPane: "list" });
    rerender(<AppLayout />);

    expect(panes?.[0]).toHaveAttribute("inert");
    expect(panes?.[1]).not.toHaveAttribute("inert");
    expect(panes?.[2]).toHaveAttribute("inert");
  });

  it("mobile: no fixed-width sidebar/list classes", () => {
    useUiStore.setState({ layoutMode: "mobile", focusedPane: "sidebar" });

    const { container } = render(<AppLayout />, { wrapper: createWrapper() });

    expect(container.innerHTML).not.toContain("w-[280px]");
    expect(container.innerHTML).not.toContain("w-[380px]");
  });

  it("compact: renders sliding layout with correct tray width", () => {
    useUiStore.setState({ layoutMode: "compact", focusedPane: "sidebar" });

    const { container } = render(<AppLayout />, { wrapper: createWrapper() });

    const tray = container.firstElementChild?.firstElementChild;
    expect(tray).toHaveClass("w-[calc(100%+280px)]");
  });

  it("wide: renders conditional panes without sliding tray", () => {
    useUiStore.setState({ layoutMode: "wide", focusedPane: "sidebar" });

    const { container } = render(<AppLayout />, { wrapper: createWrapper() });

    // Wide mode has no sliding tray
    expect(container.innerHTML).not.toContain("w-[300%]");
    expect(container.innerHTML).not.toContain("w-[calc(100%+280px)]");
    expect(container.innerHTML).toContain("w-[280px]");
    expect(container.innerHTML).toContain("w-[380px]");
  });

  it("uses overlay titlebar chrome only for macOS tauri windows", () => {
    expect(shouldUseDesktopOverlayTitlebar({ platform: "MacIntel", hasTauriRuntime: true })).toBe(true);
    expect(shouldUseDesktopOverlayTitlebar({ platform: "Win32", hasTauriRuntime: true })).toBe(false);
    expect(shouldUseDesktopOverlayTitlebar({ platform: "MacIntel", hasTauriRuntime: false })).toBe(false);
  });
});
