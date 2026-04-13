import { useTranslation } from "react-i18next";
import type { AddFeedDialogViewProps, UseAddFeedDialogViewPropsParams } from "./add-feed-dialog.types";

export function useAddFeedDialogViewProps({
  open,
  onOpenChange,
  folderLabelId,
  controller,
}: UseAddFeedDialogViewPropsParams): AddFeedDialogViewProps {
  const { t } = useTranslation("reader");
  const { t: tc } = useTranslation("common");

  return {
    open,
    onOpenChange,
    url: controller.url,
    onUrlChange: controller.setUrl,
    onDiscover: controller.handleDiscover,
    discovering: controller.discovering,
    loading: controller.loading,
    discoveredFeedsFoundLabel:
      controller.discoveredFeeds.length > 0 ? t("feeds_found", { count: controller.discoveredFeeds.length }) : null,
    discoveredFeedOptions: controller.derived.discoveredFeedOptions,
    selectedFeedUrl: controller.selectedFeedUrl ?? "",
    onSelectedFeedUrlChange: controller.setSelectedFeedUrl,
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
    error: controller.error,
    successMessage: controller.successMessage,
    urlHint: controller.derived.urlHint,
    urlHintTone: controller.derived.urlHintTone,
    isDiscoverDisabled: controller.derived.isDiscoverDisabled,
    isSubmitDisabled: controller.derived.isSubmitDisabled,
    labels: {
      title: t("add_feed"),
      description: t("add_feed_description"),
      urlLabel: t("feed_or_site_url"),
      urlPlaceholder: t("feed_url_placeholder"),
      discover: t("discover"),
      discovering: t("discovering"),
      cancel: tc("cancel"),
      add: tc("add"),
      adding: t("adding"),
    },
    inputRef: controller.inputRef,
    onSubmit: controller.handleSubmit,
  };
}
