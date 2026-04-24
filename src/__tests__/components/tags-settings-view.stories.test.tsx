import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import tagsSettingsMeta, { Default, Empty } from "@/components/settings/tags-settings-view.stories";
import { renderStory } from "../../../tests/helpers/render-story";

describe("TagsSettingsView stories", () => {
  it("renders the compact saved-tag row fixture in the default story", () => {
    renderStory(tagsSettingsMeta, Default);

    expect(screen.getByRole("heading", { name: "Tags" })).toBeInTheDocument();
    expect(screen.getByTestId("tags-settings-row-tag-1")).toBeInTheDocument();
    expect(screen.getByTestId("tags-settings-color-dot-tag-1")).toBeInTheDocument();
    expect(screen.queryByText(/^2$/)).not.toBeInTheDocument();
  });

  it("renders the empty state without any saved-tag rows", () => {
    renderStory(tagsSettingsMeta, Empty);

    expect(screen.getByText("No tags yet.")).toBeInTheDocument();
    expect(screen.queryByTestId("tags-settings-row-tag-1")).not.toBeInTheDocument();
  });
});
