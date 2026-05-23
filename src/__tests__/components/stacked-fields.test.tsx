import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createWrapper } from "@tests/helpers/create-wrapper";
import { describe, expect, it, vi } from "vitest";
import { createSelectValueChangeHandler } from "@/components/shared/select-value-change-handler";
import { StackedInputField } from "@/components/shared/stacked-input-field";
import { StackedSelectField } from "@/components/shared/stacked-select-field";

describe("stacked shared fields", () => {
  it("associates stacked input fields with their label", () => {
    render(<StackedInputField label="Feed title" name="feed-title" value="Ultra RSS" onChange={vi.fn()} />, {
      wrapper: createWrapper(),
    });

    expect(screen.getByLabelText("Feed title")).toHaveValue("Ultra RSS");
    expect(screen.getByText("Feed title").closest("label")).toHaveClass("text-foreground-soft");
  });

  it("shows the selected label for stacked select fields", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <StackedSelectField
        label="Display mode"
        name="display-mode"
        value="preview"
        options={[
          { value: "default", label: "Default" },
          { value: "preview", label: "Web Preview" },
          { value: "reader", label: "Reader" },
        ]}
        onChange={onChange}
      />,
      { wrapper: createWrapper() },
    );

    const combobox = screen.getByRole("combobox", { name: "Display mode" });
    expect(combobox).toHaveTextContent("Web Preview");
    expect(screen.getByText("Display mode").parentElement).toHaveClass("text-foreground-soft");

    await user.click(combobox);
    await user.click(await screen.findByRole("option", { name: "Reader" }));

    expect(onChange).toHaveBeenCalledWith("reader");
  });

  it("keeps generated stacked select label references stable across rerenders", () => {
    const { rerender } = render(
      <StackedSelectField
        label="Display mode"
        name="display-mode"
        value="preview"
        options={[
          { value: "default", label: "Default" },
          { value: "preview", label: "Web Preview" },
        ]}
        onChange={vi.fn()}
      />,
      { wrapper: createWrapper() },
    );

    const label = screen.getByText("Display mode");
    const labelId = label.id;

    expect(label).toHaveAttribute("id");
    expect(screen.getByRole("combobox", { name: "Display mode" })).toHaveAttribute("aria-labelledby", labelId);

    rerender(
      <StackedSelectField
        label="Display mode"
        name="display-mode"
        value="default"
        options={[
          { value: "default", label: "Default" },
          { value: "preview", label: "Web Preview" },
        ]}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Display mode")).toHaveAttribute("id", labelId);
    expect(screen.getByRole("combobox", { name: "Display mode" })).toHaveAttribute("aria-labelledby", labelId);
  });

  it("keeps explicit stacked select label references stable across rerenders", () => {
    const { rerender } = render(
      <StackedSelectField
        labelId="display-mode-label"
        label="Display mode"
        name="display-mode"
        value="preview"
        options={[
          { value: "default", label: "Default" },
          { value: "preview", label: "Web Preview" },
        ]}
        onChange={vi.fn()}
      />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByText("Display mode")).toHaveAttribute("id", "display-mode-label");
    expect(screen.getByRole("combobox", { name: "Display mode" })).toHaveAttribute(
      "aria-labelledby",
      "display-mode-label",
    );

    rerender(
      <StackedSelectField
        labelId="display-mode-label"
        label="Display mode"
        name="display-mode"
        value="default"
        options={[
          { value: "default", label: "Default" },
          { value: "preview", label: "Web Preview" },
        ]}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Display mode")).toHaveAttribute("id", "display-mode-label");
    expect(screen.getByRole("combobox", { name: "Display mode" })).toHaveAttribute(
      "aria-labelledby",
      "display-mode-label",
    );
  });

  it("does not call stacked select change handlers while disabled", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <StackedSelectField
        label="Display mode"
        name="display-mode"
        value="preview"
        options={[
          { value: "default", label: "Default" },
          { value: "preview", label: "Web Preview" },
          { value: "reader", label: "Reader" },
        ]}
        disabled
        onChange={onChange}
      />,
      { wrapper: createWrapper() },
    );

    await user.click(screen.getByRole("combobox", { name: "Display mode" }));

    expect(screen.queryByRole("option", { name: "Reader" })).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("drops null stacked select values before calling change handlers", () => {
    const onChange = vi.fn();
    const handleChange = createSelectValueChangeHandler({ disabled: false, onChange });

    handleChange(null);

    expect(onChange).not.toHaveBeenCalled();
  });

  it("drops stacked select values before calling change handlers when disabled", () => {
    const onChange = vi.fn();
    const handleChange = createSelectValueChangeHandler({ disabled: true, onChange });

    handleChange("reader");

    expect(onChange).not.toHaveBeenCalled();
  });
});
