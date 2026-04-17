import { cleanup, render, screen } from "@testing-library/react";
import { createElement } from "react";
import type { ElementType, ReactElement } from "react";
import { describe, expect, it } from "vitest";
import formActionButtonsMeta, {
  Loading as FormActionButtonsLoading,
} from "@/components/shared/form-action-buttons.stories";
import gradientSwitchMeta, {
  SettingsRow as GradientSwitchSettingsRow,
  WithLabel as GradientSwitchWithLabel,
} from "@/components/shared/gradient-switch.stories";
import iconToolbarSurfaceButtonMeta, {
  ChromeVariantComparison,
} from "@/components/shared/icon-toolbar-surface-button.stories";
import labeledInputRowMeta, {
  Disabled as LabeledInputRowDisabled,
  InsideIconAction as LabeledInputRowInsideIconAction,
} from "@/components/shared/labeled-input-row.stories";
import labeledSelectRowMeta, { Open as LabeledSelectRowOpen } from "@/components/shared/labeled-select-row.stories";
import labeledSwitchRowMeta, { On as LabeledSwitchRowOn } from "@/components/shared/labeled-switch-row.stories";
import stackedInputFieldMeta, { Disabled as StackedInputFieldDisabled } from "@/components/shared/stacked-input-field.stories";
import stackedSelectFieldMeta from "@/components/shared/stacked-select-field.stories";
import workspaceHeaderMeta, {
  BrowserPreview as WorkspaceHeaderBrowserPreview,
  MacDesktop as WorkspaceHeaderMacDesktop,
} from "@/components/shared/workspace-header.stories";
import { createWrapper } from "../../../tests/helpers/create-wrapper";

type StoryMeta = {
  component: ElementType;
  args?: object;
};

type StoryLike = {
  args?: object;
  render?: ((args: never, context: never) => ReactElement) | undefined;
};

function renderStory(meta: StoryMeta, story: StoryLike, useWrapper = false) {
  const args = { ...(meta.args ?? {}), ...(story.args ?? {}) };
  const ui = story.render ? story.render(args as never, {} as never) : createElement(meta.component, args);
  return render(ui, useWrapper ? { wrapper: createWrapper() } : undefined);
}

describe("Shared stories", () => {
  it("renders labeled field stories with their story-specific controls", async () => {
    renderStory(labeledInputRowMeta, LabeledInputRowInsideIconAction);
    expect(screen.getByRole("textbox", { name: "Username" })).toHaveValue("ultra-reader");
    expect(screen.getByRole("button", { name: "Reset username" })).toBeInTheDocument();

    cleanup();
    renderStory(labeledInputRowMeta, LabeledInputRowDisabled);
    expect(screen.getByRole("textbox", { name: "Server URL" })).toBeDisabled();

    cleanup();
    renderStory(labeledSelectRowMeta, LabeledSelectRowOpen, true);
    expect(screen.getByRole("combobox", { name: "Account type" })).toHaveTextContent("FreshRSS");
    expect(screen.getByRole("option", { name: "Feedbin" })).toBeInTheDocument();

    cleanup();
    renderStory(labeledSwitchRowMeta, LabeledSwitchRowOn);
    expect(screen.getByRole("switch", { name: "Open links in background" })).toHaveAttribute("aria-checked", "true");
  });

  it("renders action and stacked field stories with their state variants", () => {
    renderStory(formActionButtonsMeta, FormActionButtonsLoading);
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Saving" })).toBeInTheDocument();

    cleanup();
    renderStory(stackedInputFieldMeta, StackedInputFieldDisabled);
    expect(screen.getByRole("textbox", { name: "Feed title" })).toBeDisabled();

    cleanup();
    renderStory(stackedSelectFieldMeta, {}, true);
    expect(screen.getByRole("combobox", { name: "Display mode" })).toHaveTextContent("Web Preview");
  });

  it("renders shared design utility stories with their comparison layouts", () => {
    renderStory(gradientSwitchMeta, GradientSwitchWithLabel);
    expect(screen.getByText("バックグラウンドでリンクを開く")).toBeInTheDocument();

    cleanup();
    renderStory(gradientSwitchMeta, GradientSwitchSettingsRow);
    expect(screen.getAllByRole("switch")).toHaveLength(3);

    cleanup();
    renderStory(iconToolbarSurfaceButtonMeta, ChromeVariantComparison);
    expect(screen.getByText("Default Surface")).toBeInTheDocument();
    expect(screen.getByText("Chrome Variant")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Close Web Preview|Web back/ })).toHaveLength(4);
  });

  it("renders workspace header stories for browser and desktop runtime modes", () => {
    renderStory(workspaceHeaderMeta, WorkspaceHeaderBrowserPreview);
    expect(screen.getByRole("heading", { name: "購読の整理" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "戻る" })).toBeInTheDocument();

    cleanup();
    renderStory(workspaceHeaderMeta, WorkspaceHeaderMacDesktop);
    expect(screen.getAllByRole("button", { name: "閉じる" }).length).toBeGreaterThan(0);
    expect(screen.getByTestId("workspace-header-drag-region")).toHaveAttribute("data-tauri-drag-region");
  });
});
