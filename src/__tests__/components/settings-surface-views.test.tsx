import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Copy } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { ActionsSettingsView } from "@/components/settings/actions-settings-view";
import { AppearanceSettingsView } from "@/components/settings/appearance-settings-view";
import { GeneralSettingsView } from "@/components/settings/general-settings-view";
import { ReadingSettingsView } from "@/components/settings/reading-settings-view";

describe("Settings surface views", () => {
  it("renders general settings sections and delegates changes", async () => {
    const user = userEvent.setup();
    const onLanguageChange = vi.fn();
    const onOpenInBackgroundChange = vi.fn();

    render(
      <GeneralSettingsView
        title="General"
        sections={[
          {
            id: "language",
            heading: "Language",
            controls: [
              {
                id: "language",
                type: "select",
                name: "language",
                label: "Language",
                value: "system",
                options: [
                  { value: "system", label: "System default" },
                  { value: "en", label: "English" },
                ],
                onChange: onLanguageChange,
              },
            ],
          },
          {
            id: "browser",
            heading: "Browser",
            note: "Open links in the background when possible.",
            controls: [
              {
                id: "open-links-background",
                type: "switch",
                label: "Open links in background",
                checked: true,
                onChange: onOpenInBackgroundChange,
              },
            ],
          },
        ]}
      />,
    );

    expect(screen.getByRole("heading", { level: 2, name: "General" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Language" })).toHaveTextContent("System default");
    expect(screen.getByText("Open links in the background when possible.")).toBeInTheDocument();

    await user.click(screen.getByRole("combobox", { name: "Language" }));
    await user.click(await screen.findByRole("option", { name: "English" }));
    await user.click(screen.getByRole("switch", { name: "Open links in background" }));

    expect(onLanguageChange).toHaveBeenCalledWith("en");
    expect(onOpenInBackgroundChange).toHaveBeenCalledWith(false);
  });

  it("renders appearance and reading settings as props-only sections", async () => {
    const user = userEvent.setup();
    const onThemeChange = vi.fn();
    const onDisplayPresetChange = vi.fn();

    const { rerender } = render(
      <AppearanceSettingsView
        title="Appearance"
        sections={[
          {
            id: "appearance-general",
            heading: "General",
            controls: [
              {
                id: "theme",
                type: "select",
                name: "theme",
                label: "Theme",
                value: "dark",
                options: [
                  { value: "light", label: "Light" },
                  { value: "dark", label: "Dark" },
                ],
                onChange: onThemeChange,
              },
            ],
          },
        ]}
      />,
    );

    expect(screen.getByRole("heading", { level: 2, name: "Appearance" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Theme" })).toHaveTextContent("Dark");

    await user.click(screen.getByRole("combobox", { name: "Theme" }));
    await user.click(await screen.findByRole("option", { name: "Light" }));
    expect(onThemeChange).toHaveBeenCalledWith("light");

    rerender(
      <ReadingSettingsView
        title="Reading"
        sections={[
          {
            id: "reading-general",
            heading: "General",
            controls: [
              {
                id: "display-preset",
                type: "select",
                name: "display_preset",
                label: "Default display mode",
                value: "standard",
                options: [
                  { value: "standard", label: "Standard" },
                  { value: "preview", label: "Preview" },
                ],
                onChange: onDisplayPresetChange,
              },
            ],
          },
        ]}
      />,
    );

    expect(screen.getByRole("heading", { level: 2, name: "Reading" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Default display mode" })).toHaveTextContent("Standard");
  });

  it("renders action service rows and delegates switch changes", async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();

    render(
      <ActionsSettingsView
        title="Actions"
        heading="Services"
        toggleLabel="Show in toolbar"
        services={[
          {
            id: "copy-link",
            label: "Copy link",
            icon: <Copy className="h-5 w-5" />,
            checked: true,
            onCheckedChange,
          },
        ]}
      />,
    );

    expect(screen.getByRole("heading", { level: 2, name: "Actions" })).toBeInTheDocument();
    expect(screen.getByText("Copy link")).toBeInTheDocument();
    expect(screen.getByText("Show in toolbar")).toBeInTheDocument();

    await user.click(screen.getByRole("switch", { name: "Show in toolbar" }));

    expect(onCheckedChange).toHaveBeenCalledWith(false);
  });
});
