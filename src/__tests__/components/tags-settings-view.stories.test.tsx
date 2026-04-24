import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import tagsSettingsMeta, { Default, Empty } from "@/components/settings/tags-settings-view.stories";
import { renderStory } from "../../../tests/helpers/render-story";

describe("TagsSettingsView stories", () => {
  it("renders the compact saved-tag row fixture in the default story", () => {
    renderStory(tagsSettingsMeta, Default);

    const savedTagRows = screen.getAllByTestId(/^tags-settings-row-/);
    const firstRow = screen.getByTestId("tags-settings-row-tag-1");
    const secondRow = screen.getByTestId("tags-settings-row-tag-2");

    expect(screen.getByRole("heading", { name: "Tags" })).toBeInTheDocument();
    expect(savedTagRows).toHaveLength(2);
    expect(firstRow).toBeInTheDocument();
    expect(secondRow).toBeInTheDocument();
    expect(screen.getByTestId("tags-settings-color-dot-tag-1")).toBeInTheDocument();
    expect(screen.queryByTestId("tags-settings-color-dot-tag-2")).not.toBeInTheDocument();
    expect(within(firstRow).getByText("Later")).toBeInTheDocument();
    expect(within(secondRow).getByText("Reference")).toBeInTheDocument();
    expect(firstRow).toHaveTextContent(/^Later$/);
    expect(secondRow).toHaveTextContent(/^Reference$/);
  });

  it("renders the empty state without any saved-tag rows", () => {
    renderStory(tagsSettingsMeta, Empty);

    expect(screen.getByText("No tags yet.")).toBeInTheDocument();
    expect(screen.queryByTestId("tags-settings-row-tag-1")).not.toBeInTheDocument();
  });
});
