import { useId } from "react";
import { useTranslation } from "react-i18next";
import type { FeedDto, FolderDto } from "@/api/tauri-commands";
import { CopyableReadonlyFieldList } from "@/components/shared/copyable-readonly-field-list";
import { DeleteButton } from "@/components/shared/delete-button";
import { FormActionButtons } from "@/components/shared/form-action-buttons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { FeedEditDisplayPreset } from "../reader/feed-edit-submit";
import { FolderSelectView } from "../reader/folder-select-view";
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
  const folderLabelId = useId();
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
        <label className="block text-sm text-muted-foreground">
          {t("title")}
          <Input
            name="feed-title"
            type="text"
            value={controller.title}
            onChange={(event) => controller.setTitle(event.target.value)}
            className="mt-1"
            disabled={controller.loading}
          />
        </label>

        <div className="block text-sm text-muted-foreground">
          <span className="mb-1 block">{t("display_mode")}</span>
          <Select
            name="feed-display-mode"
            value={controller.displayPreset}
            onValueChange={(value) => value !== null && controller.setDisplayPreset(value as FeedEditDisplayPreset)}
            disabled={controller.loading}
          >
            <SelectTrigger aria-label={t("display_mode")} className="mt-1 w-full">
              <SelectValue>
                {(value: string | null) =>
                  controller.displayModeOptions.find((option) => option.value === value)?.label ?? value ?? ""
                }
              </SelectValue>
            </SelectTrigger>
            <SelectPopup>
              {controller.displayModeOptions.map((option) => (
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

        <section className="space-y-3 rounded-xl border border-border bg-card px-4 py-4">
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
        </section>
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
