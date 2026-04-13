import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DiscoveredFeedOptionsView } from "./discovered-feed-options-view";
import type { FeedDialogUrlSectionViewProps } from "./feed-dialog-form.types";

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
  return (
    <>
      <div className="space-y-2">
        <label htmlFor={inputId} className="block text-sm text-muted-foreground">
          {label}
        </label>
        <div className="flex gap-2">
          <Input
            id={inputId}
            ref={inputRef}
            name="feed-url"
            type="url"
            value={value}
            onChange={(event) => onValueChange(event.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            aria-describedby={helperText ? helperTextId : undefined}
            aria-errormessage={helperTone === "error" ? helperTextId : undefined}
            aria-invalid={helperTone === "error" ? true : undefined}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onDiscover}
            disabled={discoverDisabled}
            className="shrink-0"
          >
            {discovering ? discoveringLabel : discoverLabel}
          </Button>
        </div>
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

      {helperText ? (
        <p
          id={helperTextId}
          className={helperTone === "error" ? "text-sm text-destructive" : "text-sm text-muted-foreground"}
        >
          {helperText}
        </p>
      ) : null}
    </>
  );
}
