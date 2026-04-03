import { Result } from "@praha/byethrow";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { FeedDto } from "@/api/tauri-commands";
import { renameFeed, updateFeedDisplaySettings } from "@/api/tauri-commands";
import { useFolders } from "@/hooks/use-folders";
import { useUpdateFeedFolder } from "@/hooks/use-update-feed-folder";
import {
  displayPresetToTriStateModes,
  feedModesToDisplayPresetOption,
  resolveFeedDisplayOverrides,
} from "@/lib/article-display";
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
  const [displayPreset, setDisplayPreset] = useState(
    feedModesToDisplayPresetOption(
      resolveFeedDisplayOverrides(feed).readerMode,
      resolveFeedDisplayOverrides(feed).webPreviewMode,
    ),
  );
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
  const displayPresetOptions = [
    { value: "default", label: t("display_mode_default") },
    { value: "reader_only", label: t("display_mode_reader_only") },
    { value: "reader_and_preview", label: t("display_mode_reader_and_preview") },
    { value: "preview_only", label: t("display_mode_preview_only") },
  ];
  const folderOptions = buildFolderOptions(folders, t("no_folder"));

  useEffect(() => {
    if (open) {
      setTitle(feed.title);
      resetFolderSelection(feed.folder_id);
      setDisplayPreset(
        feedModesToDisplayPresetOption(
          resolveFeedDisplayOverrides(feed).readerMode,
          resolveFeedDisplayOverrides(feed).webPreviewMode,
        ),
      );
      setLoading(false);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
  }, [open, feed, feed.folder_id, feed.title, resetFolderSelection]);

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
    const currentDisplayPreset = feedModesToDisplayPresetOption(
      resolveFeedDisplayOverrides(feed).readerMode,
      resolveFeedDisplayOverrides(feed).webPreviewMode,
    );
    const didUpdateDisplayMode = displayPreset !== currentDisplayPreset;
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
      const nextModes = displayPresetToTriStateModes(
        displayPreset as "default" | "reader_only" | "reader_and_preview" | "preview_only",
      );
      Result.pipe(
        await updateFeedDisplaySettings(feed.id, nextModes.readerMode, nextModes.webPreviewMode),
        Result.inspectError((e) => showToast(t("failed_to_update_display_settings", { message: e.message }))),
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
      displayMode={displayPreset}
      displayModeOptions={displayPresetOptions}
      onOpenChange={onOpenChange}
      onTitleChange={setTitle}
      onDisplayModeChange={(value) =>
        setDisplayPreset(value as "default" | "reader_only" | "reader_and_preview" | "preview_only")
      }
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
