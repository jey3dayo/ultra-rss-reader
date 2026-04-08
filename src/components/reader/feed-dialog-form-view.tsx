import { type RefObject, useId } from "react";
import { CopyableReadonlyField } from "@/components/shared/copyable-readonly-field";
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
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type DiscoveredFeedOption, DiscoveredFeedOptionsView } from "./discovered-feed-options-view";
import { FolderSelectView, type FolderSelectViewProps } from "./folder-select-view";

export type FeedDialogFormLabels = {
  title: string;
  description?: string;
  cancel: string;
  submit: string;
  submitting: string;
};

export type FeedDialogUrlSectionProps = {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  onDiscover: () => void;
  discoverLabel: string;
  discoveringLabel: string;
  discovering: boolean;
  disabled: boolean;
  discoverDisabled: boolean;
  placeholder: string;
  inputRef?: RefObject<HTMLInputElement | null>;
  discoveredFeedsFoundLabel: string | null;
  discoveredFeedOptions: DiscoveredFeedOption[];
  selectedFeedUrl: string;
  onSelectedFeedUrlChange: (value: string) => void;
  helperText?: string | null;
  helperTone?: "muted" | "error";
};

export type FeedDialogTextSectionProps = {
  label: string;
  name: string;
  value: string;
  onValueChange: (value: string) => void;
  disabled: boolean;
  inputRef?: RefObject<HTMLInputElement | null>;
};

export type FeedDialogReadonlyFieldProps = {
  key: string;
  label: string;
  name: string;
  value: string;
  disabled?: boolean;
  copyLabel?: string;
  onCopy?: () => void;
};

export type FeedDialogSelectOption = {
  value: string;
  label: string;
};

export type FeedDialogSelectSectionProps = {
  label: string;
  name: string;
  value: string;
  options: FeedDialogSelectOption[];
  disabled: boolean;
  onValueChange: (value: string) => void;
};

export function FeedDialogFormView({
  open,
  onOpenChange,
  loading,
  isSubmitDisabled,
  labels,
  urlSection,
  textSection,
  readonlyFields,
  selectSection,
  folderSelectProps,
  error,
  successMessage,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading: boolean;
  isSubmitDisabled: boolean;
  labels: FeedDialogFormLabels;
  urlSection?: FeedDialogUrlSectionProps;
  textSection?: FeedDialogTextSectionProps;
  readonlyFields?: FeedDialogReadonlyFieldProps[];
  selectSection?: FeedDialogSelectSectionProps;
  folderSelectProps?: FolderSelectViewProps;
  error?: string | null;
  successMessage?: string | null;
  onSubmit: () => void;
}) {
  const urlHelperTextId = useId();
  const urlInputId = useId();
  const getSelectLabel = (section: FeedDialogSelectSectionProps, value: string | null) =>
    section.options.find((option) => option.value === (value ?? ""))?.label ?? value ?? "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{labels.title}</DialogTitle>
          {labels.description && <DialogDescription>{labels.description}</DialogDescription>}
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!isSubmitDisabled) {
              onSubmit();
            }
          }}
          className="space-y-4"
        >
          {urlSection && (
            <>
              <div className="space-y-2">
                <label htmlFor={urlInputId} className="block text-sm text-muted-foreground">
                  {urlSection.label}
                </label>
                <div className="flex gap-2">
                  <Input
                    id={urlInputId}
                    ref={urlSection.inputRef}
                    name="feed-url"
                    type="url"
                    value={urlSection.value}
                    onChange={(event) => urlSection.onValueChange(event.target.value)}
                    placeholder={urlSection.placeholder}
                    disabled={urlSection.disabled}
                    aria-describedby={urlSection.helperText ? urlHelperTextId : undefined}
                    aria-errormessage={urlSection.helperTone === "error" ? urlHelperTextId : undefined}
                    aria-invalid={urlSection.helperTone === "error" ? true : undefined}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={urlSection.onDiscover}
                    disabled={urlSection.discoverDisabled}
                    className="shrink-0"
                  >
                    {urlSection.discovering ? urlSection.discoveringLabel : urlSection.discoverLabel}
                  </Button>
                </div>
              </div>

              {urlSection.discoveredFeedOptions.length > 0 && urlSection.discoveredFeedsFoundLabel && (
                <DiscoveredFeedOptionsView
                  summary={urlSection.discoveredFeedsFoundLabel}
                  name="discovered-feed"
                  value={urlSection.selectedFeedUrl}
                  options={urlSection.discoveredFeedOptions}
                  onValueChange={urlSection.onSelectedFeedUrlChange}
                />
              )}

              {urlSection.helperText ? (
                <p
                  id={urlHelperTextId}
                  className={
                    urlSection.helperTone === "error" ? "text-sm text-destructive" : "text-sm text-muted-foreground"
                  }
                >
                  {urlSection.helperText}
                </p>
              ) : null}
            </>
          )}

          {textSection && (
            <label className="block text-sm text-muted-foreground">
              {textSection.label}
              <Input
                ref={textSection.inputRef}
                name={textSection.name}
                type="text"
                value={textSection.value}
                onChange={(event) => textSection.onValueChange(event.target.value)}
                className="mt-1"
                disabled={textSection.disabled}
              />
            </label>
          )}

          {readonlyFields?.map((field) => (
            <CopyableReadonlyField
              key={field.key}
              label={field.label}
              name={field.name}
              value={field.value}
              disabled={field.disabled}
              copyLabel={field.copyLabel}
              onCopy={field.onCopy}
            />
          ))}

          {selectSection && (
            <div className="block text-sm text-muted-foreground">
              <span className="mb-1 block">{selectSection.label}</span>
              <Select
                name={selectSection.name}
                value={selectSection.value}
                onValueChange={(value) => value !== null && selectSection.onValueChange(value)}
                disabled={selectSection.disabled}
              >
                <SelectTrigger aria-label={selectSection.label} className="mt-1 w-full">
                  <SelectValue>{(value: string | null) => getSelectLabel(selectSection, value)}</SelectValue>
                </SelectTrigger>
                <SelectPopup>
                  {selectSection.options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectPopup>
              </Select>
            </div>
          )}

          {folderSelectProps && <FolderSelectView {...folderSelectProps} />}

          {successMessage && !error && <p className="mt-2 text-sm text-green-400">{successMessage}</p>}
          {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            {labels.cancel}
          </Button>
          <Button onClick={onSubmit} disabled={isSubmitDisabled}>
            {loading ? labels.submitting : labels.submit}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
