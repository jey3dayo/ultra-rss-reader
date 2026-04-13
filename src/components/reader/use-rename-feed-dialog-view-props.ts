import { useTranslation } from "react-i18next";
import type {
  RenameFeedDialogViewOption,
  RenameFeedDialogViewProps,
  UseRenameFeedDialogViewPropsParams,
} from "./rename-feed-dialog.types";

export function useRenameFeedDialogViewProps({
  open,
  feedSiteUrl,
  feedUrl,
  onOpenChange,
  folderLabelId,
  controller,
}: UseRenameFeedDialogViewPropsParams): RenameFeedDialogViewProps {
  const { t } = useTranslation("reader");
  const { t: tc } = useTranslation("common");

  const displayModeOptions: RenameFeedDialogViewOption[] = [
    { value: "default", label: t("display_mode_default") },
    { value: "standard", label: t("display_mode_standard") },
    { value: "preview", label: t("display_mode_preview") },
  ];

  return {
    open,
    title: controller.title,
    loading: controller.loading,
    displayMode: controller.displayPreset,
    displayModeOptions,
    onOpenChange,
    onTitleChange: controller.setTitle,
    onDisplayModeChange: (value) => controller.setDisplayPreset(value as typeof controller.displayPreset),
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
    },
    inputRef: controller.inputRef,
    onSubmit: controller.handleSubmit,
  };
}
