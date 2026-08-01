import type { TFunction } from "i18next";
import { buildFeedDisplayPresetOptions, isFeedDisplayPresetOption } from "@/lib/articles/article-display";
import type { FeedDialogSelectOption } from "../feed-dialog-form.types";
import type { FeedEditDialogController } from "../feed-edit-dialog.types";

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
