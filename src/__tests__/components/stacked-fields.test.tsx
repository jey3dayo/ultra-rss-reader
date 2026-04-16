import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { StackedInputField } from "@/components/shared/stacked-input-field";
import { StackedSelectField } from "@/components/shared/stacked-select-field";
import { createWrapper } from "../../../tests/helpers/create-wrapper";

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
});
