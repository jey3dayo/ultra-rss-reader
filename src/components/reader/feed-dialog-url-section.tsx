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
    <div data-testid="feed-dialog-url-section" className="rounded-md border border-border/70 bg-card/55 px-4 py-4">
      <div className="space-y-3">
        <label htmlFor={inputId} className="block text-sm font-medium text-foreground/90">
          {label}
        </label>
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
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
            className="min-w-24 shrink-0"
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
          className={
            helperTone === "error"
              ? "mt-3 rounded-md border border-state-danger-border bg-state-danger-surface px-3 py-2 text-sm text-state-danger-foreground"
              : "mt-3 text-sm leading-6 text-muted-foreground"
          }
        >
          {helperText}
        </p>
      ) : null}
    </div>
  );
}
