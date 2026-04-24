import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TagsSettingsView } from "@/components/settings/tags-settings-view";

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
          { id: "tag-1", name: "Fav", color: "#cf7868" },
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
    expect(within(favRow).getByText("Fav")).toBeInTheDocument();
    expect(within(favRow).getByTestId("tags-settings-color-dot-tag-1")).toHaveClass("h-2.5", "w-2.5", "rounded-full");
    expect(within(favRow).getByRole("button", { name: "Edit Fav" })).toHaveClass("size-8");
    expect(within(favRow).getByRole("button", { name: "Delete Fav" })).toHaveClass("size-8");

    const grayRow = screen.getByTestId("tags-settings-row-tag-2");
    expect(within(grayRow).queryByTestId("tags-settings-color-dot-tag-2")).toBeNull();
    expect(screen.queryByTestId("tags-settings-swatch-tag-1")).toBeNull();
  });
});
