import { Result } from "@praha/byethrow";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SidebarFooterActions } from "@/components/reader/sidebar-footer-actions";
import { SidebarFooterActionButton } from "@/components/shared/sidebar-footer-action-button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { usePreferencesStore } from "@/stores/preferences-store";

vi.mock("@/api/tauri-commands", () => ({
  setPreference: vi.fn(async () => Result.succeed(null)),
}));

describe("SidebarFooterActions", () => {
  beforeEach(() => {
    usePreferencesStore.setState({ prefs: {}, loaded: true });
  });

  it("exposes footer utility action labels and delegates subscriptions/settings handlers", async () => {
    const user = userEvent.setup();
    const onOpenSubscriptionsIndex = vi.fn();
    const onOpenSettings = vi.fn();

    render(
      <SidebarFooterActions
        subscriptionsIndexLabel="Manage Subscriptions"
        subscriptionsIndexShortLabel="Feeds"
        settingsLabel="Settings"
        themeToggleLabel="Toggle Theme"
        onOpenSubscriptionsIndex={onOpenSubscriptionsIndex}
        onOpenSettings={onOpenSettings}
      />,
    );

    const subscriptionsButton = screen.getByRole("button", { name: "Manage Subscriptions" });
    const themeButton = screen.getByRole("button", { name: "Toggle Theme" });
    const settingsButton = screen.getByRole("button", { name: "Settings" });

    expect(subscriptionsButton).toHaveTextContent("Feeds");
    expect(subscriptionsButton.querySelector("svg.lucide-rss")).toBeInTheDocument();
    expect(themeButton.querySelector("svg.lucide-moon")).toBeInTheDocument();
    expect(settingsButton.querySelector("svg.lucide-settings")).toBeInTheDocument();
    expect(subscriptionsButton.querySelector("svg.lucide-rss")).toHaveClass("size-4");
    expect(themeButton.querySelector("svg.lucide-moon")).toHaveClass("size-4");
    expect(settingsButton.querySelector("svg.lucide-settings")).toHaveClass("size-4");

    await user.click(subscriptionsButton);
    await user.click(settingsButton);

    expect(onOpenSubscriptionsIndex).toHaveBeenCalledTimes(1);
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it("shows tooltips for footer utility actions", async () => {
    const user = userEvent.setup();

    render(
      <SidebarFooterActions
        subscriptionsIndexLabel="Manage Subscriptions"
        subscriptionsIndexShortLabel="Feeds"
        settingsLabel="Settings"
        themeToggleLabel="Toggle Theme"
        onOpenSubscriptionsIndex={vi.fn()}
        onOpenSettings={vi.fn()}
      />,
    );

    await user.hover(screen.getByRole("button", { name: "Manage Subscriptions" }));
    await waitFor(() => {
      expect(
        screen
          .getAllByText("Manage Subscriptions")
          .find((element) => element.classList.contains("motion-popup-surface")),
      ).toBeDefined();
    });

    await user.hover(screen.getByRole("button", { name: "Toggle Theme" }));
    expect(await screen.findByText("Toggle Theme")).toHaveClass("motion-popup-surface");

    await user.hover(screen.getByRole("button", { name: "Settings" }));
    expect(await screen.findByText("Settings")).toHaveClass("motion-popup-surface");
  });

  it("toggles the footer theme action between light and dark preferences", async () => {
    const user = userEvent.setup();
    usePreferencesStore.setState({ prefs: { theme: "light" }, loaded: true });

    render(
      <SidebarFooterActions
        subscriptionsIndexLabel="Manage Subscriptions"
        subscriptionsIndexShortLabel="Feeds"
        settingsLabel="Settings"
        themeToggleLabel="Toggle Theme"
        onOpenSubscriptionsIndex={vi.fn()}
        onOpenSettings={vi.fn()}
      />,
    );

    const themeButton = screen.getByRole("button", { name: "Toggle Theme" });

    await user.click(themeButton);
    expect(usePreferencesStore.getState().prefs.theme).toBe("dark");

    await user.click(themeButton);
    expect(usePreferencesStore.getState().prefs.theme).toBe("light");
  });

  it("keeps sidebar footer action styling and tooltip behavior in the shared button", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(
      <TooltipProvider>
        <SidebarFooterActionButton
          label="Manage Subscriptions"
          tooltipLabel="Manage all feeds"
          onClick={onClick}
          className="mr-auto"
        >
          <span>Feeds</span>
        </SidebarFooterActionButton>
      </TooltipProvider>,
    );

    const button = screen.getByRole("button", { name: "Manage Subscriptions" });

    expect(button).toHaveClass(
      "h-8",
      "rounded-md",
      "border-0",
      "bg-transparent",
      "text-[var(--sidebar-foreground-muted-strong)]",
      "mr-auto",
    );

    await user.hover(button);
    expect(await screen.findByText("Manage all feeds")).toHaveClass("motion-popup-surface");

    await user.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
