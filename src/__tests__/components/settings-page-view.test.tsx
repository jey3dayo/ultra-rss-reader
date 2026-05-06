import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SettingsPageView } from "@/components/settings/settings-page-view";

function expectNoButtonMinWidth(button: HTMLElement) {
  expect([...button.classList].filter((className) => className.includes("min-w"))).toEqual([]);
}

describe("SettingsPageView", () => {
  it("keeps the title fixed above the settings content scroll area", () => {
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

    expect(screen.getByTestId("settings-page-root")).toHaveClass("flex", "h-full", "min-h-0");
    expect(screen.getByTestId("settings-content-header")).toHaveClass("min-h-[4.5rem]", "shrink-0");
    expect(screen.getByTestId("settings-content-scroll-area")).toHaveClass("h-full", "min-h-0");
    expect(screen.getByRole("heading", { level: 2, name: "General" })).toHaveClass(
      "text-[color:var(--settings-shell-content-title)]",
    );
    expect(screen.getByTestId("settings-content-header")).toHaveStyle({
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

  it("uses the shared labeled input row for text controls with inline actions", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onAction = vi.fn();

    render(
      <SettingsPageView
        title="General"
        sections={[
          {
            id: "profile",
            heading: "Profile",
            controls: [
              {
                id: "display-name",
                type: "text",
                name: "display_name",
                label: "Display name",
                value: "Main reader",
                placeholder: "Main reader",
                onChange,
                actionLabel: "Reset",
                onAction,
              },
            ],
          },
        ]}
      />,
    );

    const input = screen.getByRole("textbox", { name: "Display name" });
    expect(input).toHaveValue("Main reader");
    expect(input).toHaveClass("h-10", "flex-1");
    expect(input.closest("div.flex.w-full.items-center.gap-2")).toHaveClass("sm:max-w-[30rem]", "sm:justify-end");
    expect(input.id).toBeTruthy();
    expect(document.querySelector(`label[for="${input.id}"]`)).toHaveTextContent("Display name");

    const action = screen.getByRole("button", { name: "Reset: Display name" });
    expect(action).toHaveClass("h-10", "px-4");
    expectNoButtonMinWidth(action);

    await user.clear(input);
    await user.type(input, "Reader");
    await user.click(action);

    expect(onChange).toHaveBeenCalled();
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});
