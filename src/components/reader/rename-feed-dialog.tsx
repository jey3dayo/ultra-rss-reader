import { useId } from "react";
import { useTranslation } from "react-i18next";
import type { FeedDto } from "@/api/tauri-commands";
import { RenameFeedDialogView } from "./rename-feed-dialog-view";
import { useRenameFeedDialogController } from "./use-rename-feed-dialog-controller";

export function RenameDialog({
  feed,
  open,
  onOpenChange,
}: {
  feed: FeedDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation("reader");
  const { t: tc } = useTranslation("common");
  const folderLabelId = useId();
  const controller = useRenameFeedDialogController({
    feed,
    open,
    onOpenChange,
  });
  const displayPresetOptions = [
    { value: "default", label: t("display_mode_default") },
    { value: "standard", label: t("display_mode_standard") },
    { value: "preview", label: t("display_mode_preview") },
  ];

  return (
    <RenameFeedDialogView
      open={open}
      title={controller.title}
      loading={controller.loading}
      displayMode={controller.displayPreset}
      displayModeOptions={displayPresetOptions}
      onOpenChange={onOpenChange}
      onTitleChange={controller.setTitle}
      onDisplayModeChange={(value) => controller.setDisplayPreset(value as "default" | "standard" | "preview")}
      urlFields={[
        {
          key: "website-url",
          label: t("website_url"),
          value: feed.site_url,
          copyLabel: t("copy_website_url"),
          onCopy: () => {
            void controller.handleCopy(feed.site_url);
          },
        },
        {
          key: "feed-url",
          label: t("feed_url"),
          value: feed.url,
          copyLabel: t("copy_feed_url"),
          onCopy: () => {
            void controller.handleCopy(feed.url);
          },
        },
      ]}
      folderSelectProps={{
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
      }}
      labels={{
        title: t("edit_feed"),
        titleField: t("title"),
        displayMode: t("display_mode"),
        cancel: tc("cancel"),
        save: tc("save"),
        saving: tc("saving"),
      }}
      inputRef={controller.inputRef}
      onSubmit={controller.handleSubmit}
    />
  );
}
