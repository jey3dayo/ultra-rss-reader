import { render, screen } from "@testing-library/react";
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

  it("keeps tag controls on the shared right-side settings rail", () => {
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
        tags={[{ id: "tag-1", name: "Fav", color: "#cf7868" }]}
        editLabel="Edit"
        editAriaLabel={(name) => `Edit ${name}`}
        deleteLabel="Delete"
        deleteAriaLabel={(name) => `Delete ${name}`}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByRole("textbox", { name: "Name" })).toHaveClass("h-10");
    expect(screen.getByRole("button", { name: "Create" })).toHaveClass("h-10", "sm:px-4");
    expect(screen.getByTestId("tags-settings-swatch-tag-1")).toHaveClass("h-8", "w-8");
    expect(screen.getByRole("button", { name: "Edit Fav" })).toHaveClass("h-10", "px-4");
    expect(screen.getByRole("button", { name: "Delete Fav" })).toHaveClass("h-10", "px-4");
  });
});
