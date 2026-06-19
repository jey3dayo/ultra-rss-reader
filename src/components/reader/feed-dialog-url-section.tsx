import type { RefObject } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MOTION_CONTENT_SWAP_CLASS_NAME } from "@/constants/motion";
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
    <div
      data-testid="feed-dialog-url-section"
      className="motion-contextual-surface grid gap-2 px-4 py-3.5 sm:grid-cols-[7rem_minmax(0,1fr)] sm:items-start"
    >
      <label htmlFor={inputId} className="block text-sm whitespace-nowrap text-foreground-soft sm:pt-2.5">
        {label}
      </label>
      <div className="min-w-0">
        <div className="grid min-w-0 gap-2 min-[460px]:grid-cols-[minmax(0,1fr)_auto] min-[460px]:items-center">
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
            className="min-h-11 min-w-0 bg-surface-2"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onDiscover}
            disabled={discoverDisabled}
            aria-label={discovering ? discoveringLabel : discoverLabel}
            className={cn("min-h-11 shrink-0 px-3 text-sm font-medium", discovering && "text-foreground-soft")}
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
    </div>
  );
}
