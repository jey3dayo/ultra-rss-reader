import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TagsSettingsView } from "@/components/settings/tags-settings-view";

function expectStandardSettingsActionButtonWidth(button: HTMLElement) {
  expect(button).toHaveClass("min-w-11");
}

describe("TagsSettingsView", () => {
  it("uses softened helper tones for intro and empty state", () => {
    render(
      <TagsSettingsView
        title="Tags"
        addHeading="Add tag"
        intro="Use tags to organize related articles."
        nameLabel="Name"
        nameValue=""
        namePlaceholder="News"
        colorLabel="Color"
        colorValue={null}
        colorOptions={["#cf7868", "#6f8eb8"]}
        noColorLabel="No color"
        colorOptionAriaLabel={(color) => `Color ${color}`}
        createLabel="Create"
        onNameChange={vi.fn()}
        onColorChange={vi.fn()}
        onCreate={vi.fn()}
        createDisabled={true}
        savedHeading="Saved tags"
        emptyState="No tags yet."
        tags={[]}
        editLabel="Edit"
        editAriaLabel={(name) => `Edit ${name}`}
        deleteLabel="Delete"
        deleteAriaLabel={(name) => `Delete ${name}`}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText("Use tags to organize related articles.")).toHaveClass("text-foreground-soft");
    expect(screen.getByText("No tags yet.")).toHaveClass("text-foreground-soft");
  });

  it("renders saved tags as compact identity rows with right-aligned actions", () => {
    const longTagName = "重要 مراجعة very long user-created tag display name";

    render(
      <TagsSettingsView
        title="Tags"
        addHeading="Add tag"
        intro="Use tags to organize related articles."
        nameLabel="Name"
        nameValue=""
        namePlaceholder="News"
        colorLabel="Color"
        colorValue={null}
        colorOptions={["#cf7868", "#6f8eb8"]}
        noColorLabel="No color"
        colorOptionAriaLabel={(color) => `Color ${color}`}
        createLabel="Create"
        onNameChange={vi.fn()}
        onColorChange={vi.fn()}
        onCreate={vi.fn()}
        createDisabled={false}
        savedHeading="Saved tags"
        emptyState="No tags yet."
        tags={[
          { id: "tag-1", name: longTagName, color: "#cf7868" },
          { id: "tag-2", name: "Gray", color: null },
        ]}
        editLabel="Edit"
        editAriaLabel={(name) => `Edit ${name}`}
        deleteLabel="Delete"
        deleteAriaLabel={(name) => `Delete ${name}`}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    const favRow = screen.getByTestId("tags-settings-row-tag-1");
    const favName = within(favRow).getByText(longTagName);
    expect(favName).toHaveClass("max-w-full", "truncate");
    expect(favName).toHaveAttribute("dir", "auto");
    expect(favName).toHaveAttribute("title", longTagName);
    expect(within(favRow).getByTestId("tags-settings-color-dot-tag-1")).toHaveClass("size-2.5", "rounded-full");
    expect(within(favRow).getByRole("button", { name: `Edit ${longTagName}` })).toHaveClass("size-11");
    expect(within(favRow).getByRole("button", { name: `Delete ${longTagName}` })).toHaveClass("size-11");

    const grayRow = screen.getByTestId("tags-settings-row-tag-2");
    expect(within(grayRow).queryByTestId("tags-settings-color-dot-tag-2")).toBeNull();
    expect(screen.queryByTestId("tags-settings-swatch-tag-1")).toBeNull();
  });

  it("uses the shared settings action button for the tag creation control", async () => {
    const user = userEvent.setup();
    const onNameChange = vi.fn();
    const onCreate = vi.fn();

    render(
      <TagsSettingsView
        title="Tags"
        addHeading="Add tag"
        intro="Use tags to organize related articles."
        nameLabel="Name"
        nameValue="News"
        namePlaceholder="News"
        colorLabel="Color"
        colorValue={null}
        colorOptions={["#cf7868", "#6f8eb8"]}
        noColorLabel="No color"
        colorOptionAriaLabel={(color) => `Color ${color}`}
        createLabel="Create"
        onNameChange={onNameChange}
        onColorChange={vi.fn()}
        onCreate={onCreate}
        createDisabled={false}
        savedHeading="Saved tags"
        emptyState="No tags yet."
        tags={[]}
        editLabel="Edit"
        editAriaLabel={(name) => `Edit ${name}`}
        deleteLabel="Delete"
        deleteAriaLabel={(name) => `Delete ${name}`}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    const input = screen.getByRole("textbox", { name: "Name" });
    expect(input).toHaveClass("h-10", "flex-1");
    expect(input.closest("div.flex.w-full.items-center.gap-2")).toHaveClass("sm:max-w-[30rem]", "sm:justify-end");
    expect(input.id).toBeTruthy();
    expect(document.querySelector(`label[for="${input.id}"]`)).toHaveTextContent("Name");

    const createButton = screen.getByRole("button", { name: "Create" });
    expect(createButton).toHaveClass("h-10", "px-4");
    expectStandardSettingsActionButtonWidth(createButton);

    await user.type(input, " tag");
    await user.click(createButton);

    expect(onNameChange).toHaveBeenCalled();
    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it("submits tag creation with Enter and ignores disabled submits", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();

    const { rerender } = render(
      <TagsSettingsView
        title="Tags"
        addHeading="Add tag"
        intro="Use tags to organize related articles."
        nameLabel="Name"
        nameValue="News"
        namePlaceholder="News"
        colorLabel="Color"
        colorValue={null}
        colorOptions={["#cf7868", "#6f8eb8"]}
        noColorLabel="No color"
        colorOptionAriaLabel={(color) => `Color ${color}`}
        createLabel="Create"
        onNameChange={vi.fn()}
        onColorChange={vi.fn()}
        onCreate={onCreate}
        createDisabled={false}
        savedHeading="Saved tags"
        emptyState="No tags yet."
        tags={[]}
        editLabel="Edit"
        editAriaLabel={(name) => `Edit ${name}`}
        deleteLabel="Delete"
        deleteAriaLabel={(name) => `Delete ${name}`}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    await user.type(screen.getByRole("textbox", { name: "Name" }), "{Enter}");
    expect(onCreate).toHaveBeenCalledTimes(1);

    rerender(
      <TagsSettingsView
        title="Tags"
        addHeading="Add tag"
        intro="Use tags to organize related articles."
        nameLabel="Name"
        nameValue="News"
        namePlaceholder="News"
        colorLabel="Color"
        colorValue={null}
        colorOptions={["#cf7868", "#6f8eb8"]}
        noColorLabel="No color"
        colorOptionAriaLabel={(color) => `Color ${color}`}
        createLabel="Create"
        onNameChange={vi.fn()}
        onColorChange={vi.fn()}
        onCreate={onCreate}
        createDisabled={true}
        savedHeading="Saved tags"
        emptyState="No tags yet."
        tags={[]}
        editLabel="Edit"
        editAriaLabel={(name) => `Edit ${name}`}
        deleteLabel="Delete"
        deleteAriaLabel={(name) => `Delete ${name}`}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Create" })).toBeDisabled();
    await user.type(screen.getByRole("textbox", { name: "Name" }), "{Enter}");
    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it("updates the selected color from the tag creation swatches", async () => {
    const user = userEvent.setup();
    const onColorChange = vi.fn();

    render(
      <TagsSettingsView
        title="Tags"
        addHeading="Add tag"
        intro="Use tags to organize related articles."
        nameLabel="Name"
        nameValue="News"
        namePlaceholder="News"
        colorLabel="Color"
        colorValue="#cf7868"
        colorOptions={["#cf7868", "#6f8eb8"]}
        noColorLabel="No color"
        colorOptionAriaLabel={(color) => `Color ${color}`}
        createLabel="Create"
        onNameChange={vi.fn()}
        onColorChange={onColorChange}
        onCreate={vi.fn()}
        createDisabled={false}
        savedHeading="Saved tags"
        emptyState="No tags yet."
        tags={[]}
        editLabel="Edit"
        editAriaLabel={(name) => `Edit ${name}`}
        deleteLabel="Delete"
        deleteAriaLabel={(name) => `Delete ${name}`}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByRole("radio", { name: "Color #cf7868" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Color #6f8eb8" })).not.toBeChecked();

    await user.click(screen.getByRole("radio", { name: "Color #6f8eb8" }));
    await user.click(screen.getByRole("radio", { name: "No color" }));

    expect(onColorChange).toHaveBeenNthCalledWith(1, "#6f8eb8");
    expect(onColorChange).toHaveBeenNthCalledWith(2, null);
  });
});
