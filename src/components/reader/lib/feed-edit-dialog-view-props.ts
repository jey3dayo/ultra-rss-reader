import type { TFunction } from "i18next";
import { buildFeedDisplayPresetOptions, isFeedDisplayPresetOption } from "@/lib/articles/article-display";
import type { FeedDialogSelectOption } from "../feed-dialog-form.types";
import type { FeedEditDialogController, FeedEditSaveStep } from "../feed-edit-dialog.types";

function buildSaveSummaryLines(
  controller: FeedEditDialogController,
  t: TFunction<"reader">,
): readonly string[] | undefined {
  const { saveSummary } = controller;
  if (!saveSummary) {
    return undefined;
  }

  const stepLabel = (step: FeedEditSaveStep): string => {
    switch (step) {
      case "rename":
        return t("title");
      case "folder":
        return t("folder");
      case "display":
        return t("display_mode");
    }
  };

  return [
    t("partial_save_summary"),
    t("partial_save_saved", { items: saveSummary.saved.map(stepLabel).join(" / ") }),
    t("partial_save_remaining", { items: saveSummary.remaining.map(stepLabel).join(" / ") }),
  ];
}

export type BuildFeedEditDialogViewPropsParams = {
  open: boolean;
  feedSiteUrl: string;
  feedUrl: string;
  onOpenChange: (open: boolean) => void;
  folderLabelId: string;
  controller: FeedEditDialogController;
  t: TFunction<"reader">;
  tc: TFunction<"common">;
};

export function buildFeedEditDialogViewProps({
  open,
  feedSiteUrl,
  feedUrl,
  onOpenChange,
  folderLabelId,
  controller,
  t,
  tc,
}: BuildFeedEditDialogViewPropsParams) {
  const displayModeOptions: FeedDialogSelectOption[] = buildFeedDisplayPresetOptions({
    default: t("display_mode_default"),
    standard: t("display_mode_standard"),
    preview: t("display_mode_preview"),
  });

  return {
    open,
    title: controller.title,
    loading: controller.loading,
    displayMode: controller.displayPreset,
    displayModeOptions,
    titleErrorMessage: controller.titleError ? t("title_required") : undefined,
    saveErrorMessages: controller.saveErrorMessages,
    saveSummaryLines: buildSaveSummaryLines(controller, t),
    onOpenChange,
    onTitleChange: controller.setTitle,
    onDisplayModeChange: (value: string) => {
      if (isFeedDisplayPresetOption(value)) {
        controller.setDisplayPreset(value);
      }
    },
    urlFields: [
      {
        key: "website-url",
        label: t("website_url"),
        value: feedSiteUrl,
        copyLabel: t("copy_website_url"),
        onCopy: () => {
          void controller.handleCopy(feedSiteUrl);
        },
      },
      {
        key: "feed-url",
        label: t("feed_url"),
        value: feedUrl,
        copyLabel: t("copy_feed_url"),
        onCopy: () => {
          void controller.handleCopy(feedUrl);
        },
      },
    ],
    folderSelectProps: {
      labelId: folderLabelId,
      label: t("folder"),
      value: controller.folderSelectProps.folderSelectValue,
      options: controller.folderSelectProps.folderOptions,
      canCreateFolder: true,
      disabled: controller.loading,
      isCreatingFolder: controller.folderSelectProps.isCreatingFolder,
      newFolderOptionLabel: t("new_folder"),
      newFolderLabel: t("folder_name"),
      newFolderName: controller.folderSelectProps.newFolderName,
      newFolderPlaceholder: t("enter_folder_name"),
      onValueChange: controller.folderSelectProps.handleFolderChange,
      onNewFolderNameChange: controller.folderSelectProps.setNewFolderName,
      newFolderInputRef: controller.folderSelectProps.newFolderInputRef,
    },
    labels: {
      title: t("edit_feed"),
      titleField: t("title"),
      displayMode: t("display_mode"),
      cancel: tc("cancel"),
      save: tc("save"),
      saving: tc("saving"),
      unsubscribe: t("unsubscribe"),
      unsubscribeAction: t("unsubscribe_ellipsis"),
      feedInformation: t("feed_information"),
      unsubscribeDescription: t("unsubscribe_description"),
    },
    inputRef: controller.inputRef,
    onSubmit: controller.handleSubmit,
  };
}
