import { LabeledInputRow } from "@/components/shared/labeled-input-row";
import { MOTION_CONTENT_SWAP_CLASS_NAME } from "@/constants/motion";
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
      className="motion-contextual-surface rounded-md border border-border/70 bg-surface-1/80 px-4 py-3"
    >
      <div className="space-y-2.5">
        <LabeledInputRow
          label={label}
          name="feed-url"
          type="url"
          value={value}
          onChange={onValueChange}
          placeholder={placeholder}
          disabled={disabled}
          inputRef={inputRef}
          labelClassName="text-foreground-soft"
          rowClassName="border-b-0 py-0"
          controlClassName="sm:max-w-none"
          ariaDescribedBy={hasError ? helperTextId : undefined}
          ariaErrorMessage={hasError ? helperTextId : undefined}
          ariaInvalid={hasError}
          actionLabel={discovering ? discoveringLabel : discoverLabel}
          actionAriaLabel={discovering ? discoveringLabel : discoverLabel}
          actionPlacement="inside"
          actionDisabled={discoverDisabled}
          onAction={onDiscover}
        />
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
  );
}
