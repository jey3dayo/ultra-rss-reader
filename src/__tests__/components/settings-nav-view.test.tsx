import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, expectTypeOf, it, vi } from "vitest";
import {
  type SettingsNavItem,
  type SettingsNavItemId,
  SettingsNavView,
  type SettingsNavViewProps,
} from "@/components/settings/settings-nav-view";
import type { SettingsCategory } from "@/lib/settings/settings-category.types";

describe("SettingsNavView", () => {
  it("keeps modal settings nav ids separate from reusable specimen ids", () => {
    expectTypeOf<SettingsNavItemId>().toEqualTypeOf<Exclude<SettingsCategory, "accounts">>();
    expectTypeOf<SettingsNavViewProps<"general" | "reading">>()
      .toHaveProperty("items")
      .toEqualTypeOf<SettingsNavItem<"general" | "reading">[]>();

    const modalItem = {
      id: "general",
      label: "General",
      icon: <span aria-hidden="true">G</span>,
      isActive: true,
    } satisfies SettingsNavItem;
    const specimenItem = {
      id: "custom-category",
      label: "Custom category",
      icon: <span aria-hidden="true">A</span>,
      isActive: false,
    } satisfies SettingsNavItem<"custom-category">;
    const accountNavId = "accounts";

    expect(modalItem.id).toBe("general");
    expect(specimenItem.id).toBe("custom-category");
    // @ts-expect-error negative type contract: SettingsNavItemId excludes AccountsNavView category ids.
    void (accountNavId satisfies SettingsNavItemId);
  });

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
    expect(generalButton).toHaveClass("focus-visible:ring-2", "focus-visible:ring-border-strong/45");
    expect(generalButton).toHaveAttribute("aria-current", "page");
    expect(generalButton).not.toHaveAttribute("aria-pressed");
    expect(appearanceButton).not.toHaveClass("bg-surface-selected");
    expect(appearanceButton).toHaveClass("rounded-md");
    expect(appearanceButton).toHaveClass("shrink-0");
    expect(screen.getByText("A").parentElement).toHaveClass("size-5");
    expect(screen.getByText("A").parentElement).toHaveClass("text-sidebar-foreground/44");
    expect(appearanceButton).not.toHaveAttribute("aria-current");
    expect(appearanceButton).not.toHaveAttribute("aria-pressed");
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
