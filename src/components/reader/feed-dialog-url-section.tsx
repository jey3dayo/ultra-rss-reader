import type { RefObject } from "react";
import { MOTION_CONTENT_SWAP_CLASS_NAME } from "@/constants/motion";
import { Button, Input, LabeledControlRow } from "@/design-system";
import { cn } from "@/lib/utils";
import type { DiscoveredFeedOption } from "./add-feed-dialog.types";
import { DiscoveredFeedOptionsView } from "./discovered-feed-options-view";

type FeedDialogUrlSectionProps = {
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

type FeedDialogUrlSectionViewProps = FeedDialogUrlSectionProps & {
  inputId: string;
  helperTextId: string;
};

const FEED_DIALOG_ROW_CLASS_NAME =
  "min-h-[52px] border-b-0 py-2.5 sm:grid-cols-[minmax(8.5rem,12rem)_minmax(0,1fr)] sm:items-start sm:gap-x-8 [&>div]:sm:flex [&>div]:sm:items-start [&>div]:sm:justify-end [&>div]:lg:pr-0";
const FEED_DIALOG_CONTROL_CLASS_NAME =
  "grid min-w-0 gap-2 sm:w-[20rem] min-[560px]:grid-cols-[minmax(0,1fr)_auto] min-[560px]:items-center";
const FEED_DIALOG_INPUT_CLASS_NAME = "min-h-11 bg-surface-1/78 shadow-none";
const FEED_DIALOG_DISCOVER_BUTTON_CLASS_NAME =
  "min-h-11 shrink-0 border-border/60 bg-surface-1/78 px-3 text-sm font-medium shadow-none";

export function FeedDialogUrlSection({
  label,
  value,
  onValueChange,
  onDiscover,
  discoverLabel,
  discoveringLabel,
  discovering,
  disabled,
  discoverDisabled,
  placeholder,
  inputRef,
  inputId,
  helperTextId,
  discoveredFeedsFoundLabel,
  discoveredFeedOptions,
  selectedFeedUrl,
  onSelectedFeedUrlChange,
  helperText,
  helperTone,
}: FeedDialogUrlSectionViewProps) {
  const hasError = helperTone === "error" && Boolean(helperText);

  return (
    <LabeledControlRow
      label={label}
      htmlFor={inputId}
      className={FEED_DIALOG_ROW_CLASS_NAME}
      labelClassName="whitespace-nowrap"
    >
      <div data-testid="feed-dialog-url-section" className="min-w-0">
        <div className={FEED_DIALOG_CONTROL_CLASS_NAME}>
          <Input
            id={inputId}
            ref={inputRef}
            name="feed-url"
            type="url"
            value={value}
            onChange={(event) => onValueChange(event.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            aria-describedby={hasError ? helperTextId : undefined}
            aria-errormessage={hasError ? helperTextId : undefined}
            aria-invalid={hasError || undefined}
            className={FEED_DIALOG_INPUT_CLASS_NAME}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onDiscover}
            disabled={disabled || discoverDisabled}
            aria-busy={discovering || undefined}
            aria-label={discovering ? discoveringLabel : discoverLabel}
            className={cn(FEED_DIALOG_DISCOVER_BUTTON_CLASS_NAME, discovering && "text-foreground-soft")}
          >
            {discovering ? discoveringLabel : discoverLabel}
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

        {hasError ? (
          <p
            id={helperTextId}
            data-motion-phase="entering"
            className={`${MOTION_CONTENT_SWAP_CLASS_NAME} mt-3 rounded-md border border-state-danger-border bg-state-danger-surface px-3 py-2 text-sm text-state-danger-foreground`}
          >
            {helperText}
          </p>
        ) : null}
      </div>
    </LabeledControlRow>
  );
}
