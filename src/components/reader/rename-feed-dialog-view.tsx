import type { RefObject } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FolderSelectView, type FolderSelectViewProps } from "./folder-select-view";

export type RenameFeedDialogViewLabels = {
  title: string;
  titleField: string;
  displayMode: string;
  cancel: string;
  save: string;
  saving: string;
};

export type RenameFeedDialogViewOption = {
  value: string;
  label: string;
};

export function RenameFeedDialogView({
  open,
  title,
  loading,
  displayMode,
  displayModeOptions,
  onOpenChange,
  onTitleChange,
  onDisplayModeChange,
  folderSelectProps,
  labels,
  inputRef,
  onSubmit,
}: {
  open: boolean;
  title: string;
  loading: boolean;
  displayMode: string;
  displayModeOptions: RenameFeedDialogViewOption[];
  onOpenChange: (open: boolean) => void;
  onTitleChange: (value: string) => void;
  onDisplayModeChange: (value: string) => void;
  folderSelectProps?: FolderSelectViewProps;
  labels: RenameFeedDialogViewLabels;
  inputRef?: RefObject<HTMLInputElement | null>;
  onSubmit: () => void;
}) {
  const getDisplayModeLabel = (value: string | null) =>
    displayModeOptions.find((option) => option.value === (value ?? ""))?.label ?? value ?? "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{labels.title}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
          className="space-y-4"
        >
          <label className="block text-sm text-muted-foreground">
            {labels.titleField}
            <Input
              ref={inputRef}
              name="feed-title"
              type="text"
              value={title}
              onChange={(event) => onTitleChange(event.target.value)}
              className="mt-1"
              disabled={loading}
            />
          </label>

          <div className="block text-sm text-muted-foreground">
            <span className="mb-1 block">{labels.displayMode}</span>
            <Select
              name="feed-display-mode"
              value={displayMode}
              onValueChange={(value) => onDisplayModeChange(value ?? "normal")}
              disabled={loading}
            >
              <SelectTrigger aria-label={labels.displayMode} className="mt-1 w-full">
                <SelectValue>{(value: string | null) => getDisplayModeLabel(value)}</SelectValue>
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

          {folderSelectProps && <FolderSelectView {...folderSelectProps} />}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            {labels.cancel}
          </Button>
          <Button onClick={onSubmit} disabled={!title.trim() || loading}>
            {loading ? labels.saving : labels.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
