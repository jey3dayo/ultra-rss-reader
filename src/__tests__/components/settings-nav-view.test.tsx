import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { SettingsNavItem } from "@/components/settings/settings-nav.types";
import { SettingsNavView } from "@/components/settings/settings-nav-view";

describe("SettingsNavView", () => {
  it("renders category entries from props and reports selection", () => {
    const onSelectCategory = vi.fn();
    const items: SettingsNavItem<"general" | "custom-category">[] = [
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

    expect(generalButton).toHaveClass("bg-surface-selected");
    expect(generalButton).toHaveClass("rounded-md");
    expect(generalButton).toHaveClass("shrink-0");
    expect(generalButton).toHaveClass("text-[13px]");
    expect(generalButton).toHaveClass("focus-visible:ring-0");
    expect(generalButton).toHaveAttribute("aria-pressed", "true");
    expect(appearanceButton).not.toHaveClass("bg-surface-selected");
    expect(appearanceButton).toHaveClass("rounded-md");
    expect(appearanceButton).toHaveClass("shrink-0");
    expect(screen.getByText("A").parentElement).toHaveClass("h-5");
    expect(screen.getByText("A").parentElement).toHaveClass("w-5");
    expect(screen.getByText("A").parentElement).toHaveClass("text-sidebar-foreground/44");
    expect(appearanceButton).toHaveAttribute("aria-pressed", "false");
    expect(appearanceButton).toHaveClass("w-auto");
    expect(screen.getByRole("navigation")).toHaveClass("flex");
    expect(screen.getByRole("navigation")).toHaveClass("flex-wrap");
    expect(screen.getByRole("navigation")).toHaveClass("overflow-visible");

    fireEvent.click(appearanceButton);

    expect(onSelectCategory).toHaveBeenCalledWith("custom-category");
  });

  it("does not report category selection while disabled", () => {
    const onSelectCategory = vi.fn();
    const items: SettingsNavItem<"general" | "custom-category">[] = [
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

    render(<SettingsNavView items={items} onSelectCategory={onSelectCategory} disabled />);

    const customCategoryButton = screen.getByRole("button", { name: "Custom category" });

    expect(customCategoryButton).toBeDisabled();

    fireEvent.click(customCategoryButton);

    expect(onSelectCategory).not.toHaveBeenCalled();
  });
});
