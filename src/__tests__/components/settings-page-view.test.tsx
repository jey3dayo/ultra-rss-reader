import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SettingsPageView } from "@/components/settings/settings-page-view";

describe("SettingsPageView", () => {
  it("keeps the title sticky and tightens low-height page spacing", () => {
    const { container } = render(
      <SettingsPageView
        title="General"
        sections={[
          {
            id: "general",
            heading: "Language",
            controls: [
              {
                id: "language",
                type: "select",
                name: "language",
                label: "Language",
                value: "system",
                options: [
                  { value: "system", label: "Follow system" },
                  { value: "en", label: "English" },
                ],
                onChange: vi.fn(),
              },
            ],
            note: "Changes apply after restart.",
          },
        ]}
      />,
    );

    expect(screen.getByTestId("settings-page-root")).toHaveClass("px-5");
    expect(screen.getByTestId("settings-page-root")).toHaveClass("pb-5");
    expect(screen.getByTestId("settings-page-root")).toHaveClass("pt-0");
    expect(screen.getByRole("heading", { level: 2, name: "General" })).toHaveClass("sticky");
    expect(screen.getByRole("heading", { level: 2, name: "General" })).toHaveClass("top-0");
    expect(screen.getByRole("heading", { level: 2, name: "General" })).toHaveClass(
      "text-[color:var(--settings-shell-content-title)]",
    );
    expect(screen.getByRole("heading", { level: 2, name: "General" })).toHaveStyle({
      backgroundColor: "var(--settings-shell-content-header)",
    });
    expect(container.querySelector('[data-surface-card="section"]')).toBeNull();
    expect(screen.getByRole("heading", { name: "Language" })).toHaveClass("mb-1.5");
    expect(screen.getByText("Changes apply after restart.")).toHaveClass("mt-1.5");
    expect(screen.getByRole("combobox", { name: "Language" })).toHaveClass("w-full");
  });

  it("keeps the card surface when explicitly requested", () => {
    const { container } = render(
      <SettingsPageView
        title="General"
        sectionSurface="card"
        sections={[
          {
            id: "general",
            heading: "Language",
            controls: [
              {
                id: "language",
                type: "select",
                name: "language",
                label: "Language",
                value: "system",
                options: [{ value: "system", label: "Follow system" }],
                onChange: vi.fn(),
              },
            ],
          },
        ]}
      />,
    );

    expect(container.querySelector('[data-surface-card="section"]')).not.toBeNull();
  });

  it("renders read-only info rows without interactive controls", () => {
    render(
      <SettingsPageView
        title="Debug"
        sections={[
          {
            id: "credentials",
            heading: "Credentials",
            controls: [
              {
                id: "credentials-backend",
                type: "info",
                label: "Storage backend",
                value: "OS keyring",
              },
            ],
          },
        ]}
      />,
    );

    expect(screen.getByText("Storage backend")).toBeInTheDocument();
    expect(screen.getByText("OS keyring")).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Storage backend" })).toBeNull();
  });
});
