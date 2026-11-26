import { type ReactNode, useId } from "react";
import { AppTooltip, ControlChipButton, LabelChip, TooltipProvider } from "@/design-system";
import type { SubscriptionFilterOption } from "@/lib/subscriptions/subscriptions-index.types";
import { type SubscriptionsLoadFailure, SubscriptionsLoadFailureBanner } from "./subscriptions-load-status";

export type SubscriptionsFilterBarModel = {
  ariaLabel: string;
  options: SubscriptionFilterOption[];
  activeDescription: string | null;
};

export type SubscriptionsFilterBarProps = {
  model: SubscriptionsFilterBarModel;
  loadFailure?: SubscriptionsLoadFailure | null;
  trailing?: ReactNode;
  onSelect: (filterKey: SubscriptionFilterOption["filterKey"]) => void;
};

function SubscriptionsFilterButton({
  option,
  onSelect,
}: {
  option: SubscriptionFilterOption;
  onSelect: SubscriptionsFilterBarProps["onSelect"];
}) {
  const criteriaId = useId();
  const button = (
    <ControlChipButton
      size="filter"
      pressed={option.isActive}
      aria-describedby={option.tooltip ? criteriaId : undefined}
      onClick={() => onSelect(option.filterKey)}
    >
      <span>{option.label}</span>
      {option.count === null ? null : (
        <LabelChip tone="muted" size="compact" className="rounded-sm px-1.5">
          {option.count}
        </LabelChip>
      )}
    </ControlChipButton>
  );

  return option.tooltip ? (
    <>
      <AppTooltip label={option.tooltip} side="bottom" align="start">
        {button}
      </AppTooltip>
      <span id={criteriaId} className="sr-only">
        {option.tooltip}
      </span>
    </>
  ) : (
    button
  );
}

export function SubscriptionsFilterBar({ model, loadFailure = null, trailing, onSelect }: SubscriptionsFilterBarProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
        <TooltipProvider>
          <div role="group" aria-label={model.ariaLabel} className="flex flex-wrap gap-2">
            {model.options.map((option) => (
              <SubscriptionsFilterButton key={option.filterKey} option={option} onSelect={onSelect} />
            ))}
          </div>
        </TooltipProvider>
        {trailing ? <div className="ml-auto flex min-w-0 items-center">{trailing}</div> : null}
      </div>
      {loadFailure ? (
        <SubscriptionsLoadFailureBanner failure={loadFailure} testId="subscriptions-summary-load-error" />
      ) : null}
    </div>
  );
}
