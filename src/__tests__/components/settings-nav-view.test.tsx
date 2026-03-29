import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { type SettingsNavItem, SettingsNavView } from "@/components/settings/settings-nav-view";

describe("SettingsNavView", () => {
  it("renders category entries from props and reports selection", () => {
    const onSelectCategory = vi.fn();
    const items: SettingsNavItem[] = [
      {
        id: "general",
        label: "General",
        icon: <span aria-hidden="true">G</span>,
        isActive: true,
      },
      {
        id: "appearance",
        label: "Appearance",
        icon: <span aria-hidden="true">A</span>,
        isActive: false,
      },
    ];

    render(<SettingsNavView items={items} onSelectCategory={onSelectCategory} />);

    const generalButton = screen.getByRole("button", { name: "General" });
    const appearanceButton = screen.getByRole("button", { name: "Appearance" });

    expect(generalButton).toHaveClass("bg-sidebar-accent");
    expect(appearanceButton).not.toHaveClass("bg-sidebar-accent");

    fireEvent.click(appearanceButton);

    expect(onSelectCategory).toHaveBeenCalledWith("appearance");
  });
});
