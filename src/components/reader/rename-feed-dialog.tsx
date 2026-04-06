import { Result } from "@praha/byethrow";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { FeedDto } from "@/api/tauri-commands";
import { renameFeed, updateFeedDisplaySettings } from "@/api/tauri-commands";
import { useFolders } from "@/hooks/use-folders";
import { useUpdateFeedFolder } from "@/hooks/use-update-feed-folder";
import { displayPresetToTriStateModes, resolveFeedDisplayPreset } from "@/lib/article-display";
import { copyValueToClipboard } from "@/lib/clipboard";
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
  const [displayPreset, setDisplayPreset] = useState(() => resolveFeedDisplayPreset(feed));
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
    { value: "standard", label: t("display_mode_standard") },
    { value: "preview", label: t("display_mode_preview") },
  ];
  const folderOptions = buildFolderOptions(folders, t("no_folder"));

  const handleCopy = async (value: string) => {
    await copyValueToClipboard(value, {
      onSuccess: () => showToast(t("copied_to_clipboard")),
      onError: (message, error) => {
        console.error("Copy failed:", error);
        showToast(message);
      },
    });
  };

  useEffect(() => {
    if (open) {
      setTitle(feed.title);
      resetFolderSelection(feed.folder_id);
      setDisplayPreset(resolveFeedDisplayPreset(feed));
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
    const currentDisplayPreset = resolveFeedDisplayPreset(feed);
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
      const nextModes = displayPresetToTriStateModes(displayPreset as "default" | "standard" | "preview");
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
      onDisplayModeChange={(value) => setDisplayPreset(value as "default" | "standard" | "preview")}
      urlFields={[
        {
          key: "website-url",
          label: t("website_url"),
          value: feed.site_url,
          copyLabel: t("copy_website_url"),
          onCopy: () => {
            void handleCopy(feed.site_url);
          },
        },
        {
          key: "feed-url",
          label: t("feed_url"),
          value: feed.url,
          copyLabel: t("copy_feed_url"),
          onCopy: () => {
            void handleCopy(feed.url);
          },
        },
      ]}
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
