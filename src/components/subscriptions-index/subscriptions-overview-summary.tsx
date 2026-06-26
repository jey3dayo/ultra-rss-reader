import { cva, type VariantProps } from "class-variance-authority";
import { Info } from "lucide-react";
import type { ReactNode } from "react";
import { AppTooltip, LabelChip, TooltipProvider } from "@/design-system";
import type { SubscriptionSummaryCard } from "@/lib/subscriptions/subscriptions-index.types";
import { cn } from "@/lib/utils";

type SubscriptionSummaryTone = NonNullable<SubscriptionSummaryCard["tone"]>;

const summaryToneClassNames = {
  neutral: {
    card: "border-[color:color-mix(in_srgb,var(--ring)_22%,var(--border))] bg-[color:color-mix(in_srgb,var(--ring)_6%,var(--surface-1))]",
    activeCard:
      "border-[color:color-mix(in_srgb,var(--ring)_46%,var(--border-strong))] bg-[color:color-mix(in_srgb,var(--ring)_10%,var(--surface-1))] shadow-[var(--subscriptions-summary-active-shadow-neutral)]",
    activeAccent: "bg-ring",
    activeBadge:
      "border-[color:color-mix(in_srgb,var(--ring)_42%,var(--border-strong))] bg-[color:color-mix(in_srgb,var(--ring)_10%,var(--surface-1))] text-foreground",
    activeValue: "text-foreground",
  },
  stale: {
    card: "border-state-danger-border/72 bg-state-danger-surface/82",
    activeCard:
      "border-state-danger-border/90 bg-state-danger-surface shadow-[var(--subscriptions-summary-active-shadow-stale)]",
    activeAccent: "bg-state-danger-border",
    activeBadge: "border-state-danger-border/75 bg-state-danger-surface/92 text-state-danger-foreground",
    activeValue: "text-state-danger-foreground",
  },
  review: {
    card: "border-state-warning-border/78 bg-state-warning-surface/86",
    activeCard:
      "border-state-warning-border/95 bg-state-warning-surface shadow-[var(--subscriptions-summary-active-shadow-review)]",
    activeAccent: "bg-state-warning-border",
    activeBadge: "border-state-warning-border/75 bg-state-warning-surface/92 text-state-warning-foreground",
    activeValue: "text-state-warning-foreground",
  },
} as const satisfies Record<
  SubscriptionSummaryTone,
  {
    card: string;
    activeCard: string;
    activeAccent: string;
    activeBadge: string;
    activeValue: string;
  }
>;

const summaryTextVariants = cva("", {
  variants: {
    variant: {
      label: "text-[10px] font-semibold tracking-[0.12em] text-foreground-soft uppercase",
      actionableValue:
        "mt-1.5 block text-[1.58rem] font-semibold tracking-[-0.035em] text-foreground sm:text-[1.78rem]",
      staticValue: "mt-1.5 text-[1.48rem] font-semibold tracking-[-0.03em] text-foreground sm:text-[1.62rem]",
      actionableCaption:
        "mt-0.5 max-w-[26ch] text-[12px] leading-[1.45] text-foreground-soft sm:max-w-[28ch] sm:text-[12px]",
      staticCaption:
        "mt-1 max-w-[26ch] text-[12px] leading-[1.45] text-foreground-soft sm:max-w-[28ch] sm:text-[13px] sm:leading-[1.5]",
    },
  },
});

type SummaryTextVariantProps = VariantProps<typeof summaryTextVariants>;

type SummaryTextProps = {
  as: "p" | "span";
  children: ReactNode;
  className?: string;
  variant: NonNullable<SummaryTextVariantProps["variant"]>;
};

function SummaryText({ as, children, className, variant }: SummaryTextProps) {
  const resolvedClassName = cn(summaryTextVariants({ variant }), className);

  if (as === "span") {
    return <span className={resolvedClassName}>{children}</span>;
  }

  return <p className={resolvedClassName}>{children}</p>;
}

function resolveSummaryToneClasses(tone: SubscriptionSummaryCard["tone"] = "neutral") {
  return summaryToneClassNames[tone ?? "neutral"];
}

function canSelectSummaryFilterCard(card: SubscriptionSummaryCard) {
  return card.isActionable ?? true;
}

type SummaryFilterCardButtonProps = {
  labels: SubscriptionsOverviewSummaryLabels;
  onSelect: (filterKey: SubscriptionSummaryCard["filterKey"]) => void;
  reviewCriteriaLabel?: string;
  renderValue?: (card: SubscriptionSummaryCard) => ReactNode;
  summaryCard: SubscriptionSummaryCard;
};

type SummaryCardViewState = {
  className: string;
  isActionable: boolean;
  isProminent: boolean;
  toneClasses: (typeof summaryToneClassNames)[SubscriptionSummaryTone];
};

type SummaryCardRenderModel = {
  card: SubscriptionSummaryCard;
  value: ReactNode;
  viewState: SummaryCardViewState;
};

export type SubscriptionsOverviewSummaryLabels = {
  activeBadge: string;
  staticBadge: string;
  showFilterAriaLabel: (label: string) => string;
  filterAll: string;
  filter: string;
  criteria: string;
};

const DEFAULT_SUMMARY_LABELS: SubscriptionsOverviewSummaryLabels = {
  activeBadge: "表示中",
  staticBadge: "参照",
  showFilterAriaLabel: (label) => `${label} を表示`,
  filterAll: "すべて表示",
  filter: "絞り込む",
  criteria: "条件",
};

function isZeroCountAttentionCard(card: SubscriptionSummaryCard) {
  return (
    (card.filterKey === "review" || card.filterKey === "stale") &&
    isNumericSummaryValue(card.value) &&
    Number(card.value) === 0
  );
}

function resolveSummaryCardClassName({
  card,
  isActiveActionable,
  isProminent,
}: {
  card: SubscriptionSummaryCard;
  isActiveActionable: boolean;
  isProminent: boolean;
}) {
  const toneClasses = resolveSummaryToneClasses(card.tone);

  return cn(
    "motion-static-hover-surface relative flex min-h-[92px] w-full min-w-0 flex-col justify-between overflow-hidden rounded-md border px-3.5 py-3 text-left sm:min-h-[102px] sm:px-4 sm:py-3.5",
    toneClasses.card,
    isProminent && "shadow-[var(--subscriptions-summary-card-shadow)]",
    isProminent && "sm:col-span-2 lg:col-span-1",
    isActiveActionable ? toneClasses.activeCard : "shadow-none",
  );
}

function resolveSummaryCardViewState(card: SubscriptionSummaryCard): SummaryCardViewState {
  const isActionable = canSelectSummaryFilterCard(card);
  const isActiveActionable = isActionable && Boolean(card.isActive);
  const displayTone = isZeroCountAttentionCard(card) ? "neutral" : card.tone;
  const isProminent = card.tone === "review" && !isZeroCountAttentionCard(card);
  const toneClasses = resolveSummaryToneClasses(displayTone);

  return {
    className: resolveSummaryCardClassName({ card: { ...card, tone: displayTone }, isActiveActionable, isProminent }),
    isActionable,
    isProminent,
    toneClasses,
  };
}

function resolveActiveBadgeLabel(labels: SubscriptionsOverviewSummaryLabels) {
  return labels.activeBadge;
}

function resolveStaticBadgeLabel(labels: SubscriptionsOverviewSummaryLabels) {
  return labels.staticBadge;
}

function resolveSummaryFilterCardAriaLabel(card: SubscriptionSummaryCard, labels: SubscriptionsOverviewSummaryLabels) {
  return labels.showFilterAriaLabel(card.label);
}

function resolveActionChipLabel({
  filterKey,
  labels,
}: {
  filterKey: SubscriptionSummaryCard["filterKey"];
  labels: SubscriptionsOverviewSummaryLabels;
}) {
  return filterKey === "all" ? labels.filterAll : labels.filter;
}

function resolveCriteriaChipLabel(labels: SubscriptionsOverviewSummaryLabels) {
  return labels.criteria;
}

function isNumericSummaryValue(value: string) {
  return value.trim() !== "" && !Number.isNaN(Number(value));
}

function renderDefaultSummaryValue(card: SubscriptionSummaryCard) {
  if (isNumericSummaryValue(card.value)) {
    return <span className="tabular-nums">{card.value}</span>;
  }

  return card.value;
}

function buildSummaryCardRenderModel(params: {
  card: SubscriptionSummaryCard;
  renderValue?: (card: SubscriptionSummaryCard) => ReactNode;
}): SummaryCardRenderModel {
  const { card, renderValue } = params;
  return {
    card,
    value: renderValue?.(card) ?? renderDefaultSummaryValue(card),
    viewState: resolveSummaryCardViewState(card),
  };
}

function SummaryFilterCardButton({
  labels,
  onSelect,
  reviewCriteriaLabel,
  renderValue,
  summaryCard,
}: SummaryFilterCardButtonProps) {
  const {
    value,
    viewState: { className: cardClassName, isProminent, toneClasses },
  } = buildSummaryCardRenderModel({
    card: summaryCard,
    renderValue,
  });
  const shouldShowCriteria = summaryCard.filterKey === "review" && Boolean(reviewCriteriaLabel);
  const isZeroAttention = isZeroCountAttentionCard(summaryCard);
  const shouldShowActionChip = !summaryCard.isActive && !isZeroAttention;

  const cardButton = (
    <button
      type="button"
      className={cn(
        cardClassName,
        "group cursor-pointer hover:border-border-strong/90 focus-visible:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45",
      )}
      aria-label={resolveSummaryFilterCardAriaLabel(summaryCard, labels)}
      aria-pressed={Boolean(summaryCard.isActive)}
      onClick={() => onSelect(summaryCard.filterKey)}
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute inset-x-0 top-0 h-1 transition-opacity duration-150",
          toneClasses.activeAccent,
          summaryCard.isActive ? "opacity-100" : "opacity-0",
        )}
      />
      <div>
        <div className="mb-2 flex items-start justify-between gap-3">
          <SummaryText as="span" variant="label" className="block">
            {summaryCard.label}
          </SummaryText>
          <span data-testid="subscriptions-summary-card-badge-slot" className="flex min-w-[3.75rem] justify-end">
            <span
              className={cn(
                "inline-flex h-5 items-center rounded-full border border-border-strong/70 bg-surface-1 px-2 text-[10px] font-medium tracking-[0.12em] text-foreground uppercase shadow-[var(--subscriptions-summary-badge-shadow)]",
                summaryCard.isActive && toneClasses.activeBadge,
                !summaryCard.isActive && "invisible",
              )}
              aria-hidden={summaryCard.isActive ? undefined : "true"}
            >
              {resolveActiveBadgeLabel(labels)}
            </span>
          </span>
        </div>
        <SummaryText
          as="span"
          variant="actionableValue"
          className={cn(summaryCard.isActive && toneClasses.activeValue)}
        >
          {value}
        </SummaryText>
        {summaryCard.caption ? (
          <SummaryText as="p" variant="actionableCaption" className={cn(summaryCard.isActive && "text-foreground")}>
            {summaryCard.caption}
          </SummaryText>
        ) : null}
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-3">
        {shouldShowActionChip ? (
          <LabelChip
            tone="neutral"
            className={cn(
              "px-2 py-0.75 text-[10px] text-foreground-soft transition-colors duration-150 ease-standard group-hover:text-foreground motion-reduce:transition-none",
              isProminent && "bg-surface-1/88",
            )}
          >
            {resolveActionChipLabel({
              filterKey: summaryCard.filterKey,
              labels,
            })}
          </LabelChip>
        ) : (
          <span aria-hidden="true" />
        )}
        {shouldShowCriteria ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-border/55 bg-surface-1/76 px-2 py-0.75 text-[10px] font-medium text-foreground-soft transition-colors duration-150 ease-standard group-hover:border-border-strong/65 group-hover:text-foreground motion-reduce:transition-none">
            <Info className="size-3" aria-hidden="true" />
            {resolveCriteriaChipLabel(labels)}
          </span>
        ) : null}
      </div>
    </button>
  );

  return shouldShowCriteria && reviewCriteriaLabel ? (
    <TooltipProvider>
      <AppTooltip label={reviewCriteriaLabel} side="bottom" align="start">
        {cardButton}
      </AppTooltip>
    </TooltipProvider>
  ) : (
    cardButton
  );
}

type SubscriptionsOverviewSummaryProps = {
  cards: SubscriptionSummaryCard[];
  labels?: SubscriptionsOverviewSummaryLabels;
  onSelectFilter: (filterKey: SubscriptionSummaryCard["filterKey"]) => void;
  renderValue?: (card: SubscriptionSummaryCard) => ReactNode;
  reviewCriteriaLabel?: string;
};

export function SubscriptionsOverviewSummary({
  cards,
  labels = DEFAULT_SUMMARY_LABELS,
  onSelectFilter,
  renderValue,
  reviewCriteriaLabel,
}: SubscriptionsOverviewSummaryProps) {
  return (
    <section className="p-0 shadow-none">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[repeat(auto-fit,minmax(13rem,1fr))] lg:gap-3">
        {cards.map((card) => {
          const { value, viewState } = buildSummaryCardRenderModel({ card, renderValue });

          if (viewState.isActionable) {
            return (
              <SummaryFilterCardButton
                key={card.label}
                labels={labels}
                onSelect={onSelectFilter}
                reviewCriteriaLabel={reviewCriteriaLabel}
                renderValue={renderValue}
                summaryCard={card}
              />
            );
          }

          return (
            <div
              key={card.label}
              data-subscriptions-summary-static-card=""
              className={cn(viewState.className, "shadow-none")}
            >
              <div>
                <div className="mb-2 flex min-h-6 items-start justify-between gap-3">
                  <SummaryText as="p" variant="label">
                    {card.label}
                  </SummaryText>
                  <span className="rounded-full border border-border/55 bg-background/70 px-2.5 py-1 text-[10px] font-medium tracking-[0.12em] text-foreground-soft">
                    {resolveStaticBadgeLabel(labels)}
                  </span>
                </div>
                <SummaryText as="p" variant="staticValue" className="text-foreground-soft">
                  {value}
                </SummaryText>
                {card.caption ? (
                  <SummaryText as="p" variant="staticCaption">
                    {card.caption}
                  </SummaryText>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
