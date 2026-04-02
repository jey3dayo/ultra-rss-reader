import { Result } from "@praha/byethrow";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { FeedDto } from "@/api/tauri-commands";
import { renameFeed, updateFeedDisplayMode } from "@/api/tauri-commands";
import { useFolders } from "@/hooks/use-folders";
import { useUpdateFeedFolder } from "@/hooks/use-update-feed-folder";
import { useUiStore } from "@/stores/ui-store";
import { createFolderIfNeeded } from "./feed-folder-flow";
import { RenameFeedDialogView } from "./rename-feed-dialog-view";
import { buildFolderOptions, useFolderSelection } from "./use-folder-selection";

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
  const [title, setTitle] = useState(feed.title);
  const [displayMode, setDisplayMode] = useState(feed.display_mode ?? "inherit");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const {
    selectedFolderId,
    newFolderName,
    isCreatingFolder,
    newFolderInputRef,
    folderSelectValue,
    handleFolderChange,
    resetFolderSelection,
    setNewFolderName,
  } = useFolderSelection(feed.folder_id);
  const qc = useQueryClient();
  const showToast = useUiStore((s) => s.showToast);
  const { data: folders } = useFolders(feed.account_id);
  const updateFeedFolderMutation = useUpdateFeedFolder();
  const folderLabelId = useId();
  const displayModeOptions = [
    { value: "inherit", label: t("display_mode_default") },
    { value: "normal", label: t("display_mode_normal") },
    { value: "widescreen", label: t("display_mode_widescreen") },
  ];
  const folderOptions = buildFolderOptions(folders, t("no_folder"));

  useEffect(() => {
    if (open) {
      setTitle(feed.title);
      resetFolderSelection(feed.folder_id);
      setDisplayMode(feed.display_mode ?? "inherit");
      setLoading(false);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
  }, [open, feed.title, feed.folder_id, feed.display_mode, resetFolderSelection]);

  const handleSubmit = async () => {
    const trimmed = title.trim();
    if (!trimmed) {
      onOpenChange(false);
      return;
    }
    setLoading(true);
    const resolvedFolderId = await createFolderIfNeeded({
      accountId: feed.account_id,
      selectedFolderId,
      isCreatingFolder,
      newFolderName,
      onError: (error) => {
        showToast(t("failed_to_create_folder", { message: error.message }));
      },
    });
    if (resolvedFolderId === undefined) {
      setLoading(false);
      return;
    }

    const didRename = trimmed !== feed.title;
    const didMoveFolder = resolvedFolderId !== feed.folder_id;
    const didUpdateDisplayMode = displayMode !== (feed.display_mode ?? "inherit");
    let folderUpdateSucceeded = false;

    if (didRename) {
      Result.pipe(
        await renameFeed(feed.id, trimmed),
        Result.inspectError((e) => showToast(t("failed_to_rename", { message: e.message }))),
      );
    }

    if (didMoveFolder) {
      folderUpdateSucceeded = await updateFeedFolderMutation
        .mutateAsync({ feedId: feed.id, folderId: resolvedFolderId })
        .then(() => true)
        .catch(() => false);
    }

    if (didUpdateDisplayMode) {
      Result.pipe(
        await updateFeedDisplayMode(feed.id, displayMode),
        Result.inspectError((e) => showToast(t("failed_to_update_display_mode", { message: e.message }))),
      );
    }

    if ((didRename || didUpdateDisplayMode) && !folderUpdateSucceeded) {
      qc.invalidateQueries({ queryKey: ["feeds"] });
    }
    qc.invalidateQueries({ queryKey: ["folders"] });
    setLoading(false);
    onOpenChange(false);
  };

  return (
    <RenameFeedDialogView
      open={open}
      title={title}
      loading={loading}
      displayMode={displayMode}
      displayModeOptions={displayModeOptions}
      onOpenChange={onOpenChange}
      onTitleChange={setTitle}
      onDisplayModeChange={setDisplayMode}
      folderSelectProps={{
        labelId: folderLabelId,
        label: t("folder"),
        value: folderSelectValue,
        options: folderOptions,
        canCreateFolder: true,
        disabled: loading,
        isCreatingFolder,
        newFolderOptionLabel: t("new_folder"),
        newFolderLabel: t("folder_name"),
        newFolderName,
        newFolderPlaceholder: t("enter_folder_name"),
        onValueChange: handleFolderChange,
        onNewFolderNameChange: setNewFolderName,
        newFolderInputRef,
      }}
      labels={{
        title: t("edit_feed"),
        titleField: t("title"),
        displayMode: t("display_mode"),
        cancel: tc("cancel"),
        save: tc("save"),
        saving: tc("saving"),
      }}
      inputRef={inputRef}
      onSubmit={handleSubmit}
    />
  );
}
