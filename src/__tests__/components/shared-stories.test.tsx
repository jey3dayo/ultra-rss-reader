import { cleanup, screen } from "@testing-library/react";
import { createWrapper } from "@tests/helpers/create-wrapper";
import {
  renderStory as renderStoryHelper,
  type StoryArgs,
  type StoryDecorator,
  type StoryLike,
  type StoryMeta,
} from "@tests/helpers/render-story";
import { describe, expect, it } from "vitest";
import copyableReadonlyFieldMeta, {
  Default as CopyableReadonlyFieldDefault,
  Disabled as CopyableReadonlyFieldDisabled,
} from "@/components/shared/copyable-readonly-field.stories";
import copyableReadonlyFieldListMeta, {
  CardSurface as CopyableReadonlyFieldListCardSurface,
  Plain as CopyableReadonlyFieldListPlain,
} from "@/components/shared/copyable-readonly-field-list.stories";
import formActionButtonsMeta, {
  Loading as FormActionButtonsLoading,
  LongLocalizedLabels as FormActionButtonsLongLocalizedLabels,
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
  InsideTextAction as LabeledInputRowInsideTextAction,
} from "@/components/shared/labeled-input-row.stories";
import labeledSelectRowMeta, { Open as LabeledSelectRowOpen } from "@/components/shared/labeled-select-row.stories";
import labeledSwitchRowMeta, { On as LabeledSwitchRowOn } from "@/components/shared/labeled-switch-row.stories";
import stackedInputFieldMeta, {
  Disabled as StackedInputFieldDisabled,
} from "@/components/shared/stacked-input-field.stories";
import stackedSelectFieldMeta from "@/components/shared/stacked-select-field.stories";
import workspaceHeaderMeta, {
  BrowserPreview as WorkspaceHeaderBrowserPreview,
  MacDesktop as WorkspaceHeaderMacDesktop,
  WindowsDesktop as WorkspaceHeaderWindowsDesktop,
} from "@/components/shared/workspace-header.stories";

function renderStory<TArgs extends StoryArgs>(meta: StoryMeta<TArgs>, story: StoryLike<TArgs>) {
  return renderStoryHelper(meta, story);
}

function renderStoryWithWrapper<TArgs extends StoryArgs>(meta: StoryMeta<TArgs>, story: StoryLike<TArgs>) {
  return renderStoryHelper(meta, story, { wrapper: createWrapper() });
}

describe("Shared stories", () => {
  it("applies meta and story decorators when rendering stories", () => {
    const meta = {
      component: ({ label }: { label: string }) => <span>{label}</span>,
      args: { label: "Meta label" },
      decorators: [
        ((Story) => (
          <section data-testid="meta-decorator">
            <Story />
          </section>
        )) satisfies StoryDecorator<{ label: string }>,
      ],
    } satisfies StoryMeta<{ label: string }>;
    const story = {
      args: { label: "Story label" },
      decorators: [
        ((Story) => (
          <div data-testid="story-decorator">
            <Story />
          </div>
        )) satisfies StoryDecorator<{ label: string }>,
      ],
    } satisfies StoryLike<{ label: string }>;

    renderStory(meta, story);

    expect(screen.getByTestId("meta-decorator")).toContainElement(screen.getByTestId("story-decorator"));
    expect(screen.getByText("Story label")).toBeInTheDocument();
  });

  it("renders labeled field stories with their story-specific controls", async () => {
    renderStory(copyableReadonlyFieldMeta, CopyableReadonlyFieldDefault);
    expect(screen.getByRole("textbox", { name: "Feed URL" })).toHaveValue("https://example.com/feed.xml");
    expect(screen.getByRole("button", { name: "Copy feed URL" })).toBeInTheDocument();

    cleanup();
    renderStory(copyableReadonlyFieldMeta, CopyableReadonlyFieldDisabled);
    expect(screen.getByRole("textbox", { name: "Feed URL" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Copy feed URL" })).toBeDisabled();

    cleanup();
    renderStory(copyableReadonlyFieldListMeta, CopyableReadonlyFieldListPlain);
    expect(screen.getByRole("textbox", { name: "Website URL" })).toHaveValue("https://example.com");
    expect(screen.getByRole("textbox", { name: "Feed URL" })).toHaveValue("https://example.com/feed.xml");

    cleanup();
    const { container } = renderStory(copyableReadonlyFieldListMeta, CopyableReadonlyFieldListCardSurface);
    expect(container.querySelector(".rounded-md.border.bg-card")).not.toBeNull();

    cleanup();
    renderStory(labeledInputRowMeta, LabeledInputRowInsideIconAction);
    expect(screen.getByRole("textbox", { name: "Username" })).toHaveValue("ultra-reader");
    expect(screen.getByRole("button", { name: "Reset username" })).toBeInTheDocument();

    cleanup();
    renderStory(labeledInputRowMeta, LabeledInputRowInsideTextAction);
    expect(screen.getByRole("textbox", { name: "Feed or Site URL" })).toHaveAttribute(
      "placeholder",
      "https://example.com/feed.xml",
    );
    expect(screen.getByRole("button", { name: "Discover feed" })).toHaveClass("h-7", "min-w-14");

    cleanup();
    renderStory(labeledInputRowMeta, LabeledInputRowDisabled);
    expect(screen.getByRole("textbox", { name: "Server URL" })).toBeDisabled();

    cleanup();
    renderStoryWithWrapper(labeledSelectRowMeta, LabeledSelectRowOpen);
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
    renderStory(formActionButtonsMeta, FormActionButtonsLongLocalizedLabels);
    expect(screen.getByRole("button", { name: "詳細な同期設定を破棄" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "変更内容を保存して同期を再開" })).toBeInTheDocument();

    cleanup();
    renderStory(stackedInputFieldMeta, StackedInputFieldDisabled);
    expect(screen.getByRole("textbox", { name: "Feed title" })).toBeDisabled();

    cleanup();
    renderStoryWithWrapper(stackedSelectFieldMeta, {});
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
    expect(screen.getByRole("heading", { name: "購読一覧" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "戻る" })).toBeInTheDocument();
    expect(screen.queryByTestId("workspace-header-drag-region")).toBeNull();

    cleanup();
    renderStory(workspaceHeaderMeta, WorkspaceHeaderMacDesktop);
    expect(screen.getAllByRole("button", { name: "閉じる" }).length).toBeGreaterThan(0);
    expect(screen.getByTestId("workspace-header-drag-region")).toHaveAttribute("data-tauri-drag-region");

    cleanup();
    renderStory(workspaceHeaderMeta, WorkspaceHeaderWindowsDesktop);
    expect(screen.getByRole("heading", { name: "購読一覧" })).toBeInTheDocument();
    expect(screen.queryByTestId("workspace-header-drag-region")).toBeNull();
  });
});
