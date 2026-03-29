import type { RefObject } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { type DiscoveredFeedOption, DiscoveredFeedOptionsView } from "./discovered-feed-options-view";
import { FolderSelectView, type FolderSelectViewProps } from "./folder-select-view";

export type AddFeedDialogViewLabels = {
  title: string;
  description: string;
  urlPlaceholder: string;
  discover: string;
  discovering: string;
  cancel: string;
  add: string;
  adding: string;
};

export function AddFeedDialogView({
  open,
  onOpenChange,
  url,
  onUrlChange,
  onDiscover,
  discovering,
  loading,
  discoveredFeedsFoundLabel,
  discoveredFeedOptions,
  selectedFeedUrl,
  onSelectedFeedUrlChange,
  folderSelectProps,
  error,
  successMessage,
  isDiscoverDisabled,
  isSubmitDisabled,
  labels,
  inputRef,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string;
  onUrlChange: (value: string) => void;
  onDiscover: () => void;
  discovering: boolean;
  loading: boolean;
  discoveredFeedsFoundLabel: string | null;
  discoveredFeedOptions: DiscoveredFeedOption[];
  selectedFeedUrl: string;
  onSelectedFeedUrlChange: (value: string) => void;
  folderSelectProps: FolderSelectViewProps;
  error: string | null;
  successMessage: string | null;
  isDiscoverDisabled: boolean;
  isSubmitDisabled: boolean;
  labels: AddFeedDialogViewLabels;
  inputRef?: RefObject<HTMLInputElement | null>;
  onSubmit: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{labels.title}</DialogTitle>
          <DialogDescription>{labels.description}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
          className="space-y-4"
        >
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              name="feed-url"
              type="url"
              value={url}
              onChange={(event) => onUrlChange(event.target.value)}
              placeholder={labels.urlPlaceholder}
              disabled={loading || discovering}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onDiscover}
              disabled={isDiscoverDisabled}
              className="shrink-0"
            >
              {discovering ? labels.discovering : labels.discover}
            </Button>
          </div>

          {discoveredFeedOptions.length > 0 && discoveredFeedsFoundLabel && (
            <DiscoveredFeedOptionsView
              summary={discoveredFeedsFoundLabel}
              name="discovered-feed"
              value={selectedFeedUrl}
              options={discoveredFeedOptions}
              onValueChange={onSelectedFeedUrlChange}
            />
          )}

          <FolderSelectView {...folderSelectProps} />

          {successMessage && !error && <p className="mt-2 text-sm text-green-400">{successMessage}</p>}
          {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            {labels.cancel}
          </Button>
          <Button onClick={onSubmit} disabled={isSubmitDisabled}>
            {loading ? labels.adding : labels.add}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
