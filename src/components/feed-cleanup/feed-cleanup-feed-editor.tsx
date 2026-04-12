import { Result } from "@praha/byethrow";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import type { FeedDto, FolderDto } from "@/api/tauri-commands";
import { syncFeed } from "@/api/tauri-commands";
import { CopyableReadonlyFieldList } from "@/components/shared/copyable-readonly-field-list";
import { DeleteButton } from "@/components/shared/delete-button";
import { FormActionButtons } from "@/components/shared/form-action-buttons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUpdateFeedDisplaySettings } from "@/hooks/use-update-feed-display-mode";
import { useUpdateFeedFolder } from "@/hooks/use-update-feed-folder";
import { resolveFeedDisplayPreset } from "@/lib/article-display";
import { copyValueToClipboard } from "@/lib/clipboard";
import { useUiStore } from "@/stores/ui-store";
import { type FeedEditDisplayPreset, submitFeedEdits } from "../reader/feed-edit-submit";
import { FolderSelectView } from "../reader/folder-select-view";
import { buildFolderOptions, useFolderSelection } from "../reader/use-folder-selection";

export function FeedCleanupFeedEditor({
  feed,
  folders,
  maintenanceTitle,
  maintenanceDescription,
  refetchLabel,
  unsubscribeLabel,
  onCancel,
  onDelete,
  onSaved,
}: {
  feed: FeedDto;
  folders: FolderDto[];
  maintenanceTitle: string;
  maintenanceDescription: string;
  refetchLabel: string;
  unsubscribeLabel: string;
  onCancel: () => void;
  onDelete: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation("reader");
  const { t: tCleanup } = useTranslation("cleanup");
  const { t: tc } = useTranslation("common");
  const qc = useQueryClient();
  const showToast = useUiStore((state) => state.showToast);
  const updateFeedFolderMutation = useUpdateFeedFolder();
  const [title, setTitle] = useState(feed.title);
  const updateFeedDisplaySettings = useUpdateFeedDisplaySettings();
  const [displayPreset, setDisplayPreset] = useState<FeedEditDisplayPreset>(() => resolveFeedDisplayPreset(feed));
  const [loading, setLoading] = useState(false);
  const [refetching, setRefetching] = useState(false);
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
  const folderLabelId = useId();
  const folderOptions = buildFolderOptions(folders, t("no_folder"));
  const displayModeOptions = [
    { value: "default", label: t("display_mode_default") },
    { value: "standard", label: t("display_mode_standard") },
    { value: "preview", label: t("display_mode_preview") },
  ] as const;

  useEffect(() => {
    setTitle(feed.title);
    resetFolderSelection(feed.folder_id);
    setDisplayPreset(resolveFeedDisplayPreset(feed));
    setLoading(false);
  }, [feed, resetFolderSelection]);

  const handleCopy = async (value: string) => {
    await copyValueToClipboard(value, {
      onSuccess: () => showToast(t("copied_to_clipboard")),
      onError: (message) => showToast(message),
    });
  };

  const handleSave = async () => {
    if (!title.trim()) {
      return;
    }

    setLoading(true);
    try {
      const saved = await submitFeedEdits({
        feed,
        title,
        displayPreset,
        selectedFolderId,
        isCreatingFolder,
        newFolderName,
        queryClient: qc,
        showToast,
        createFolderErrorMessage: (error) => t("failed_to_create_folder", { message: error.message }),
        renameErrorMessage: (error) => t("failed_to_rename", { message: error.message }),
        updateFeedFolder: ({ feedId, folderId }) =>
          updateFeedFolderMutation
            .mutateAsync({ feedId, folderId })
            .then(() => true)
            .catch(() => false),
        updateDisplaySettings: updateFeedDisplaySettings,
      });

      if (saved) {
        onSaved();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRefetch = async () => {
    setRefetching(true);
    const result = await syncFeed(feed.id);
    setRefetching(false);

    Result.pipe(
      result,
      Result.inspect((syncResult) => {
        void qc.invalidateQueries({ queryKey: ["feeds"] });
        void qc.invalidateQueries({ queryKey: ["folders"] });
        void qc.invalidateQueries({ queryKey: ["articles"] });
        void qc.invalidateQueries({ queryKey: ["accountArticles"] });
        void qc.invalidateQueries({ queryKey: ["accountUnreadCount"] });
        void qc.invalidateQueries({ queryKey: ["feedIntegrityReport"] });

        if (!syncResult.synced) {
          showToast(tCleanup("editor_refetch_in_progress"));
        } else if (syncResult.failed.length > 0) {
          const names = syncResult.failed.map((failure) => failure.account_name).join(", ");
          showToast(tCleanup("editor_refetch_failed", { message: names }));
        } else if (syncResult.warnings.length > 0) {
          showToast(tCleanup("editor_refetch_completed_with_warnings"));
        } else {
          showToast(tCleanup("editor_refetch_complete"));
        }
      }),
      Result.inspectError((error) => {
        showToast(tCleanup("editor_refetch_failed", { message: error.message }));
      }),
    );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-base font-semibold">{t("edit_feed")}</h4>
          <p className="mt-1 text-sm text-muted-foreground">{feed.title}</p>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
        <label className="block text-sm text-muted-foreground">
          {t("title")}
          <Input
            name="feed-title"
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="mt-1"
            disabled={loading}
          />
        </label>

        <div className="block text-sm text-muted-foreground">
          <span className="mb-1 block">{t("display_mode")}</span>
          <Select
            name="feed-display-mode"
            value={displayPreset}
            onValueChange={(value) => value !== null && setDisplayPreset(value as FeedEditDisplayPreset)}
            disabled={loading}
          >
            <SelectTrigger aria-label={t("display_mode")} className="mt-1 w-full">
              <SelectValue>
                {(value: string | null) =>
                  displayModeOptions.find((option) => option.value === value)?.label ?? value ?? ""
                }
              </SelectValue>
            </SelectTrigger>
            <SelectPopup>
              {displayModeOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectPopup>
          </Select>
        </div>

        <FolderSelectView
          labelId={folderLabelId}
          label={t("folder")}
          value={folderSelectValue}
          options={folderOptions}
          canCreateFolder={true}
          disabled={loading}
          isCreatingFolder={isCreatingFolder}
          newFolderOptionLabel={t("new_folder")}
          newFolderLabel={t("folder_name")}
          newFolderName={newFolderName}
          newFolderPlaceholder={t("enter_folder_name")}
          onValueChange={handleFolderChange}
          onNewFolderNameChange={setNewFolderName}
          newFolderInputRef={newFolderInputRef}
        />

        <CopyableReadonlyFieldList
          className="rounded-xl border border-border bg-card px-4 py-4"
          fields={[
            {
              key: "website-url",
              label: t("website_url"),
              name: "website-url",
              value: feed.site_url,
              copyLabel: t("copy_website_url"),
              disabled: loading,
              onCopy: () => {
                void handleCopy(feed.site_url);
              },
            },
            {
              key: "feed-url",
              label: t("feed_url"),
              name: "feed-url",
              value: feed.url,
              copyLabel: t("copy_feed_url"),
              disabled: loading,
              onCopy: () => {
                void handleCopy(feed.url);
              },
            },
          ]}
        />

        <section className="space-y-3 rounded-xl border border-border bg-card px-4 py-4">
          <div>
            <h5 className="text-sm font-semibold text-foreground">{maintenanceTitle}</h5>
            <p className="mt-1 text-sm text-muted-foreground">{maintenanceDescription}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={refetching} onClick={() => void handleRefetch()}>
              {refetching ? tCleanup("editor_refetching") : refetchLabel}
            </Button>
          </div>
          <DeleteButton onClick={onDelete} disabled={loading || refetching}>
            {unsubscribeLabel}
          </DeleteButton>
        </section>
      </div>

      <div className="border-t border-border/70 pt-3">
        <div className="flex flex-wrap gap-2">
          <FormActionButtons
            cancelLabel={tc("cancel")}
            submitLabel={tc("save")}
            submittingLabel={tc("saving")}
            loading={loading}
            submitDisabled={!title.trim() || loading || refetching}
            cancelDisabled={loading || refetching}
            onCancel={onCancel}
            onSubmit={() => {
              void handleSave();
            }}
          />
        </div>
      </div>
    </div>
  );
}
