import { cleanup, screen } from "@testing-library/react";
import { renderStory } from "@tests/helpers/render-story";
import { afterEach, describe, expect, it } from "vitest";
import addAccountFormMeta, { FreshRSSConfig } from "@/components/settings/add-account/add-account-form.stories";
import workspaceHeaderMeta, { BrowserPreview, MacDesktop } from "@/components/shared/workspace-header.stories";
import { removeStoryRuntimeTauriInternals } from "@/components/storybook/story-tauri-runtime";

describe("Storybook decorator runtime provider parity", () => {
  afterEach(() => {
    removeStoryRuntimeTauriInternals();
  });

  it("renders decorator-wrapped add-account stories with the story query provider", () => {
    renderStory(addAccountFormMeta, FreshRSSConfig);

    expect(screen.getByRole("textbox", { name: "Server URL" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add" })).toBeInTheDocument();
  });

  it("keeps story Tauri runtime modes aligned with workspace header stories", () => {
    renderStory(workspaceHeaderMeta, BrowserPreview);
    expect(window.__TAURI_INTERNALS__).toBeUndefined();
    expect(screen.queryByTestId("workspace-header-drag-region")).toBeNull();

    cleanup();
    renderStory(workspaceHeaderMeta, MacDesktop);
    expect(window.__TAURI_INTERNALS__).toEqual({});
    expect(screen.getByTestId("workspace-header-drag-region")).toHaveAttribute("data-tauri-drag-region");
  });
});
