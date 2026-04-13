import { useTranslation } from "react-i18next";
import { CopyableReadonlyFieldList } from "@/components/shared/copyable-readonly-field-list";
import { DeleteButton } from "@/components/shared/delete-button";
import { FormActionButtons } from "@/components/shared/form-action-buttons";
import { StackedInputField } from "@/components/shared/stacked-input-field";
import { StackedSelectField } from "@/components/shared/stacked-select-field";
import { Button } from "@/components/ui/button";
import type { FeedEditDisplayPreset } from "../reader/feed-edit-submit";
import { FolderSelectView } from "../reader/folder-select-view";
import { FeedCleanupCard } from "./feed-cleanup-card";
import type { FeedCleanupFeedEditorProps } from "./feed-cleanup.types";
import { useFeedCleanupFeedEditorController } from "./use-feed-cleanup-feed-editor-controller";

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
}: FeedCleanupFeedEditorProps) {
  const { t } = useTranslation("reader");
  const { t: tCleanup } = useTranslation("cleanup");
  const { t: tc } = useTranslation("common");
  const controller = useFeedCleanupFeedEditorController({
    feed,
    folders,
    onSaved,
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-base font-semibold">{t("edit_feed")}</h4>
          <p className="mt-1 text-sm text-muted-foreground">{feed.title}</p>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
        <StackedInputField
          label={t("title")}
          name="feed-title"
          type="text"
          value={controller.title}
          onChange={controller.setTitle}
          inputClassName="mt-1"
          disabled={controller.loading}
        />

        <StackedSelectField
          label={t("display_mode")}
          name="feed-display-mode"
          value={controller.displayPreset}
          options={controller.displayModeOptions}
          onChange={(value) => controller.setDisplayPreset(value as FeedEditDisplayPreset)}
          disabled={controller.loading}
          triggerClassName="mt-1 w-full"
        />

        <FolderSelectView
          label={t("folder")}
          value={controller.folderSelectProps.folderSelectValue}
          options={controller.folderSelectProps.folderOptions}
          canCreateFolder={true}
          disabled={controller.loading}
          isCreatingFolder={controller.folderSelectProps.isCreatingFolder}
          newFolderOptionLabel={t("new_folder")}
          newFolderLabel={t("folder_name")}
          newFolderName={controller.folderSelectProps.newFolderName}
          newFolderPlaceholder={t("enter_folder_name")}
          onValueChange={controller.folderSelectProps.handleFolderChange}
          onNewFolderNameChange={controller.folderSelectProps.setNewFolderName}
          newFolderInputRef={controller.folderSelectProps.newFolderInputRef}
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
              disabled: controller.loading,
              onCopy: () => {
                void controller.handleCopy(feed.site_url);
              },
            },
            {
              key: "feed-url",
              label: t("feed_url"),
              name: "feed-url",
              value: feed.url,
              copyLabel: t("copy_feed_url"),
              disabled: controller.loading,
              onCopy: () => {
                void controller.handleCopy(feed.url);
              },
            },
          ]}
        />

        <FeedCleanupCard className="space-y-3">
          <div>
            <h5 className="text-sm font-semibold text-foreground">{maintenanceTitle}</h5>
            <p className="mt-1 text-sm text-muted-foreground">{maintenanceDescription}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={controller.refetching} onClick={() => void controller.handleRefetch()}>
              {controller.refetching ? tCleanup("editor_refetching") : refetchLabel}
            </Button>
          </div>
          <DeleteButton onClick={onDelete} disabled={controller.loading || controller.refetching}>
            {unsubscribeLabel}
          </DeleteButton>
        </FeedCleanupCard>
      </div>

      <div className="border-t border-border/70 pt-3">
        <div className="flex flex-wrap gap-2">
          <FormActionButtons
            cancelLabel={tc("cancel")}
            submitLabel={tc("save")}
            submittingLabel={tc("saving")}
            loading={controller.loading}
            submitDisabled={!controller.title.trim() || controller.loading || controller.refetching}
            cancelDisabled={controller.loading || controller.refetching}
            onCancel={onCancel}
            onSubmit={() => {
              void controller.handleSave();
            }}
          />
        </div>
      </div>
    </div>
  );
}
