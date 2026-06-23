import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { SettingsPageView } from "@/components/settings/settings-page-view";

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

  it("keeps desktop switch labels on one line when the control is compact", () => {
    render(
      <SettingsPageView
        title="Reading"
        sections={[
          {
            id: "scroll",
            heading: "Scroll",
            controls: [
              {
                id: "scroll-to-top-on-change",
                type: "switch",
                label: "フィード切り替え時にトップへスクロール",
                checked: true,
                onChange: vi.fn(),
              },
            ],
          },
        ]}
      />,
    );

    expect(screen.getByText("フィード切り替え時にトップへスクロール")).toHaveClass("sm:whitespace-nowrap");
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
                actionAriaLabel: "Reset display name",
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

    const action = screen.getByRole("button", { name: "Reset display name" });
    expect(action).toHaveClass("h-10", "px-4");
    expect(action).toHaveClass("min-h-11", "min-w-11");

    await user.clear(input);
    await user.type(input, "Reader");
    await user.click(action);

    expect(onChange).toHaveBeenCalled();
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("prefers explicit inline text action aria labels", () => {
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
                onChange: vi.fn(),
                actionLabel: "Reset",
                actionAriaLabel: "Reset reader display name",
                onAction: vi.fn(),
              },
            ],
          },
        ]}
      />,
    );

    expect(screen.getByRole("button", { name: "Reset reader display name" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reset: Display name" })).toBeNull();
  });

  it("requires inline text actions to provide an explicit aria label at the view contract", () => {
    type TextControl = ComponentProps<typeof SettingsPageView>["sections"][number]["controls"][number];
    type InlineTextControl = Extract<TextControl, { type: "text"; actionLabel: string }>;

    const validInlineTextControl = {
      id: "display-name",
      type: "text",
      name: "display_name",
      label: "Display name",
      value: "Main reader",
      onChange: vi.fn(),
      actionLabel: "Reset",
      actionAriaLabel: "Reset display name",
      onAction: vi.fn(),
    } satisfies InlineTextControl;

    expect(validInlineTextControl.actionAriaLabel).toBe("Reset display name");
  });

  it("prefers explicit action row aria labels", () => {
    render(
      <SettingsPageView
        title="General"
        sections={[
          {
            id: "history",
            heading: "History",
            controls: [
              {
                id: "clear-history",
                type: "action",
                label: "Recent history",
                actionLabel: "Clear",
                actionAriaLabel: "Clear recent history",
                onAction: vi.fn(),
              },
            ],
          },
        ]}
      />,
    );

    expect(screen.getByRole("button", { name: "Clear recent history" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Clear: Recent history" })).toBeNull();
  });

  it("exposes semantic busy feedback for action rows", () => {
    render(
      <SettingsPageView
        title="General"
        sections={[
          {
            id: "history",
            heading: "History",
            controls: [
              {
                id: "clear-history",
                type: "action",
                label: "Recent history",
                actionLabel: "Clear",
                actionLoading: true,
                actionLoadingLabel: "Clearing",
                actionAriaLabel: "Clear recent history",
                onAction: vi.fn(),
              },
            ],
          },
        ]}
      />,
    );

    const action = screen.getByRole("button", { name: "Clear recent history" });

    expect(action).toBeDisabled();
    expect(action).toHaveAttribute("aria-busy", "true");
    expect(action).toHaveTextContent("Clearing");
  });

  it("disables inline text actions when the input or action is disabled", () => {
    const onAction = vi.fn();
    const baseControl = {
      id: "display-name",
      type: "text" as const,
      name: "display_name",
      label: "Display name",
      value: "Main reader",
      onChange: vi.fn(),
      actionLabel: "Reset",
      actionAriaLabel: "Reset display name",
      onAction,
    };

    const { rerender } = render(
      <SettingsPageView
        title="General"
        sections={[
          {
            id: "profile",
            heading: "Profile",
            controls: [{ ...baseControl, disabled: true, actionDisabled: false }],
          },
        ]}
      />,
    );

    expect(screen.getByRole("button", { name: "Reset display name" })).toBeDisabled();

    rerender(
      <SettingsPageView
        title="General"
        sections={[
          {
            id: "profile",
            heading: "Profile",
            controls: [{ ...baseControl, disabled: false, actionDisabled: true }],
          },
        ]}
      />,
    );

    expect(screen.getByRole("button", { name: "Reset display name" })).toBeDisabled();

    rerender(
      <SettingsPageView
        title="General"
        sections={[
          {
            id: "profile",
            heading: "Profile",
            controls: [{ ...baseControl, disabled: false, actionDisabled: false }],
          },
        ]}
      />,
    );

    expect(screen.getByRole("button", { name: "Reset display name" })).not.toBeDisabled();
  });
});
