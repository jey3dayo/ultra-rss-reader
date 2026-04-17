import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { SettingsNavItem } from "@/components/settings/settings-nav.types";
import { SettingsNavView } from "@/components/settings/settings-nav-view";

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
        id: "custom-category",
        label: "Custom category",
        icon: <span aria-hidden="true">A</span>,
        isActive: false,
      },
    ];

    render(<SettingsNavView items={items} onSelectCategory={onSelectCategory} />);

    const generalButton = screen.getByRole("button", { name: "General" });
    const appearanceButton = screen.getByRole("button", { name: "Custom category" });

    expect(generalButton).toHaveClass("bg-[var(--bg-selected)]");
    expect(generalButton).toHaveClass("rounded-md");
    expect(generalButton).toHaveClass("shrink-0");
    expect(generalButton).toHaveAttribute("aria-pressed", "true");
    expect(appearanceButton).not.toHaveClass("bg-[var(--bg-selected)]");
    expect(appearanceButton).toHaveClass("rounded-md");
    expect(appearanceButton).toHaveClass("shrink-0");
    expect(screen.getByText("A").parentElement).toHaveClass("text-sidebar-foreground/44");
    expect(appearanceButton).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("navigation")).toHaveClass("flex");
    expect(screen.getByRole("navigation")).toHaveClass("overflow-x-auto");

    fireEvent.click(appearanceButton);

    expect(onSelectCategory).toHaveBeenCalledWith("custom-category");
  });
});
