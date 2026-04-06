import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SettingsModalView } from "@/components/settings/settings-modal-view";

describe("SettingsModalView", () => {
  it("renders header, navigation slots, and content", () => {
    const onClose = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <SettingsModalView
        open={true}
        title="Preferences"
        closeLabel="Close preferences"
        navigation={<div data-testid="settings-nav">Settings navigation</div>}
        accountsNavigation={<div data-testid="accounts-nav">Accounts navigation</div>}
        content={<div>Settings content</div>}
        onClose={onClose}
        onOpenChange={onOpenChange}
      />,
    );

    expect(screen.getByRole("heading", { name: "Preferences" })).toBeInTheDocument();
    expect(screen.getByTestId("settings-nav")).toHaveTextContent("Settings navigation");
    expect(screen.getByTestId("accounts-nav")).toHaveTextContent("Accounts navigation");
    expect(screen.getByText("Settings content")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Close preferences" }));

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("keeps both settings scroll areas shrinkable inside the modal columns", () => {
    render(
      <SettingsModalView
        open={true}
        title="Preferences"
        closeLabel="Close preferences"
        navigation={<div>Settings navigation</div>}
        accountsNavigation={<div>Accounts navigation</div>}
        content={<div>Settings content</div>}
        onClose={vi.fn()}
        onOpenChange={vi.fn()}
      />,
    );

    const scrollAreas = screen.getAllByTestId("settings-scroll-area");

    expect(scrollAreas).toHaveLength(2);
    for (const scrollArea of scrollAreas) {
      expect(scrollArea).toHaveClass("min-h-0");
      expect(scrollArea).toHaveClass("flex-1");
    }
  });

  it("does not render dialog content when closed", () => {
    render(
      <SettingsModalView
        open={false}
        title="Preferences"
        closeLabel="Close preferences"
        navigation={<div>Settings navigation</div>}
        accountsNavigation={<div>Accounts navigation</div>}
        content={<div>Settings content</div>}
        onClose={vi.fn()}
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders the top loading bar only when isLoading is true", () => {
    const { rerender } = render(
      <SettingsModalView
        open={true}
        title="Preferences"
        closeLabel="Close preferences"
        navigation={<div>Settings navigation</div>}
        accountsNavigation={<div>Accounts navigation</div>}
        content={<div>Settings content</div>}
        isLoading={false}
        onClose={vi.fn()}
        onOpenChange={vi.fn()}
      />,
    );

    expect(document.querySelector(".animate-indeterminate")).toBeNull();

    rerender(
      <SettingsModalView
        open={true}
        title="Preferences"
        closeLabel="Close preferences"
        navigation={<div>Settings navigation</div>}
        accountsNavigation={<div>Accounts navigation</div>}
        content={<div>Settings content</div>}
        isLoading={true}
        onClose={vi.fn()}
        onOpenChange={vi.fn()}
      />,
    );

    expect(document.querySelector(".animate-indeterminate")).not.toBeNull();
  });
});
