import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SettingsModalView } from "@/components/settings/settings-modal-view";
import settingsModalStories, { Loading } from "@/components/settings/settings-modal-view.stories";
import { ToolbarPreview } from "@/components/shared/indeterminate-progress.stories";

describe("IndeterminateProgress stories", () => {
  it("renders the toolbar preview story with the loading tone bar", () => {
    render(ToolbarPreview.render?.({}, {} as never) ?? null);

    const loadingBar = document.querySelector(".bg-\\[var\\(--tone-loading\\)\\]");
    expect(loadingBar).not.toBeNull();
    expect(screen.getByText("Loading preview")).toBeInTheDocument();
  });

  it("exposes a settings modal loading story", () => {
    expect(Loading.args?.isLoading).toBe(true);

    render(<SettingsModalView {...(settingsModalStories.args ?? {})} {...(Loading.args ?? {})} />);

    const loadingBar = document.querySelector(".bg-\\[var\\(--tone-loading\\)\\]");
    expect(loadingBar).not.toBeNull();
    expect(screen.getByText("General settings")).toBeInTheDocument();
  });
});
