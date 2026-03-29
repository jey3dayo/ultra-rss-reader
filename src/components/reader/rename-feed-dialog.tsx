import { Result } from "@praha/byethrow";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { FeedDto } from "@/api/tauri-commands";
import { renameFeed, updateFeedDisplayMode, updateFeedFolder } from "@/api/tauri-commands";
import { useFolders } from "@/hooks/use-folders";
import { useUiStore } from "@/stores/ui-store";
import { RenameFeedDialogView } from "./rename-feed-dialog-view";

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
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(feed.folder_id);
  const [displayMode, setDisplayMode] = useState(feed.display_mode ?? "normal");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const showToast = useUiStore((s) => s.showToast);
  const { data: folders } = useFolders(feed.account_id);
  const folderLabelId = useId();
  const displayModeOptions = [
    { value: "normal", label: t("display_mode_normal") },
    { value: "widescreen", label: t("display_mode_widescreen") },
  ];
  const folderOptions = [
    { value: "", label: t("no_folder") },
    ...((folders ?? []).map((folder) => ({ value: folder.id, label: folder.name })) ?? []),
  ];

  useEffect(() => {
    if (open) {
      setTitle(feed.title);
      setSelectedFolderId(feed.folder_id);
      setDisplayMode(feed.display_mode ?? "normal");
      setLoading(false);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
  }, [open, feed.title, feed.folder_id, feed.display_mode]);

  const handleSubmit = async () => {
    const trimmed = title.trim();
    if (!trimmed) {
      onOpenChange(false);
      return;
    }
    setLoading(true);

    if (trimmed !== feed.title) {
      Result.pipe(
        await renameFeed(feed.id, trimmed),
        Result.inspectError((e) => showToast(t("failed_to_rename", { message: e.message }))),
      );
    }

    if (selectedFolderId !== feed.folder_id) {
      Result.pipe(
        await updateFeedFolder(feed.id, selectedFolderId),
        Result.inspectError((e) => showToast(t("failed_to_update_folder", { message: e.message }))),
      );
    }

    if (displayMode !== (feed.display_mode ?? "normal")) {
      Result.pipe(
        await updateFeedDisplayMode(feed.id, displayMode),
        Result.inspectError((e) => showToast(t("failed_to_update_display_mode", { message: e.message }))),
      );
    }

    qc.invalidateQueries({ queryKey: ["feeds"] });
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
      folderSelectProps={
        folders && folders.length > 0
          ? {
              labelId: folderLabelId,
              label: t("folder"),
              value: selectedFolderId ?? "",
              options: folderOptions,
              disabled: loading,
              isCreatingFolder: false,
              newFolderLabel: "",
              newFolderName: "",
              newFolderPlaceholder: "",
              onValueChange: (value) => setSelectedFolderId(value || null),
              onNewFolderNameChange: () => {},
            }
          : undefined
      }
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
