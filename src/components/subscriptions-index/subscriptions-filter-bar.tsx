import { cva } from "class-variance-authority";
import { useId } from "react";
import { AppTooltip, TooltipProvider } from "@/design-system";
import type { SubscriptionFilterOption } from "@/lib/subscriptions/subscriptions-index.types";
import { type SubscriptionsLoadFailure, SubscriptionsLoadFailureBanner } from "./subscriptions-load-status";

export type SubscriptionsFilterBarModel = {
  ariaLabel: string;
  options: SubscriptionFilterOption[];
  activeDescription: string | null;
};

const filterButtonVariants = cva(
  "inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-3.5 system-micro transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45 motion-reduce:transition-none",
  {
    variants: {
      selected: {
        true: "border-[color:color-mix(in_srgb,var(--ring)_46%,var(--border-strong))] bg-[color:color-mix(in_srgb,var(--ring)_10%,var(--surface-1))] text-foreground",
        false:
          "border-border/60 bg-surface-1/58 text-foreground-soft hover:border-border-strong/80 hover:text-foreground",
      },
    },
    defaultVariants: { selected: false },
  },
);

export type SubscriptionsFilterBarProps = {
  model: SubscriptionsFilterBarModel;
  loadFailure?: SubscriptionsLoadFailure | null;
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
    <button
      type="button"
      aria-pressed={option.isActive}
      aria-describedby={option.tooltip ? criteriaId : undefined}
      className={filterButtonVariants({ selected: option.isActive })}
      onClick={() => onSelect(option.filterKey)}
    >
      <span>{option.label}</span>
      {option.count === null ? null : <span className="tabular-nums">{option.count}</span>}
    </button>
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

export function SubscriptionsFilterBar({ model, loadFailure = null, onSelect }: SubscriptionsFilterBarProps) {
  return (
    <div className="flex flex-col gap-3">
      <TooltipProvider>
        <div role="group" aria-label={model.ariaLabel} className="flex flex-wrap gap-2">
          {model.options.map((option) => (
            <SubscriptionsFilterButton key={option.filterKey} option={option} onSelect={onSelect} />
          ))}
        </div>
      </TooltipProvider>
      {loadFailure ? (
        <SubscriptionsLoadFailureBanner failure={loadFailure} testId="subscriptions-summary-load-error" />
      ) : null}
    </div>
  );
}
