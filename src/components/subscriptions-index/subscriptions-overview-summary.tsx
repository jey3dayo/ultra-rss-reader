import { cva, type VariantProps } from "class-variance-authority";
import { Info } from "lucide-react";
import type { ReactNode } from "react";
import { AppTooltip, LabelChip, MotionNumber, TooltipProvider } from "@/design-system";
import type { SubscriptionSummaryCard } from "@/lib/subscriptions/subscriptions-index.types";
import { cn } from "@/lib/utils";

type SubscriptionSummaryTone = NonNullable<SubscriptionSummaryCard["tone"]>;

const summaryToneClassNames = {
  neutral: {
    card: "border-border/60 bg-surface-1/62",
    activeCard:
      "border-border-strong bg-surface-1 shadow-[var(--subscriptions-summary-active-shadow-neutral)] ring-1 ring-[color:var(--subscriptions-summary-active-ring-neutral)]",
    activeAccent: "bg-secondary",
    activeBadge: "border-border-strong/70 bg-surface-1 text-foreground",
    activeValue: "text-foreground",
  },
  stale: {
    card: "border-state-warning-border/75 bg-state-warning-surface/84",
    activeCard:
      "border-state-warning-border/90 bg-state-warning-surface shadow-[var(--subscriptions-summary-active-shadow-stale)] ring-1 ring-[color:var(--subscriptions-summary-active-ring-stale)]",
    activeAccent: "bg-state-warning-border",
    activeBadge: "border-state-warning-border/75 bg-state-warning-surface/92 text-state-warning-foreground",
    activeValue: "text-state-warning-foreground",
  },
  review: {
    card: "border-state-review-border/80 bg-state-review-surface/86",
    activeCard:
      "border-state-review-border/95 bg-state-review-surface shadow-[var(--subscriptions-summary-active-shadow-review)] ring-1 ring-[color:var(--subscriptions-summary-active-ring-review)]",
    activeAccent: "bg-state-review-border",
    activeBadge: "border-state-review-border/75 bg-state-review-surface/92 text-state-review-foreground",
    activeValue: "text-state-review-foreground",
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
      label: "text-[11px] font-medium tracking-[0.14em] text-foreground-soft uppercase",
      actionableValue: "mt-1.5 block text-[1.72rem] font-semibold tracking-[-0.04em] text-foreground sm:text-[1.96rem]",
      staticValue: "mt-2 text-[1.56rem] font-semibold tracking-[-0.03em] text-foreground sm:text-[1.76rem]",
      actionableCaption:
        "mt-1 max-w-[24ch] text-[12px] leading-5 text-foreground-soft sm:max-w-[26ch] sm:text-[13px] sm:leading-[1.5]",
      staticCaption:
        "mt-1.5 max-w-[24ch] text-[13px] leading-5 text-foreground-soft sm:mt-2 sm:max-w-[26ch] sm:text-sm sm:leading-[1.55]",
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
    "motion-static-hover-surface relative flex min-h-[96px] w-full min-w-0 flex-col justify-between overflow-hidden rounded-md border px-3.5 py-3 text-left sm:min-h-[108px] sm:px-4.5 sm:py-4",
    toneClasses.card,
    isProminent && "shadow-[var(--subscriptions-summary-card-shadow)]",
    isProminent && "sm:col-span-2 lg:col-span-1",
    isActiveActionable ? toneClasses.activeCard : "shadow-none",
  );
}

function resolveSummaryCardViewState(card: SubscriptionSummaryCard): SummaryCardViewState {
  const isActionable = canSelectSummaryFilterCard(card);
  const isActiveActionable = isActionable && Boolean(card.isActive);
  const isProminent = card.tone === "review";
  const toneClasses = resolveSummaryToneClasses(card.tone);

  return {
    className: resolveSummaryCardClassName({ card, isActiveActionable, isProminent }),
    isActionable,
    isProminent,
    toneClasses,
  };
}

function resolveActiveBadgeLabel() {
  return "表示中";
}

function resolveStaticBadgeLabel() {
  return "参照";
}

function resolveSummaryFilterCardAriaLabel(card: SubscriptionSummaryCard) {
  return `${card.label} を表示`;
}

function resolveActionChipLabel({
  filterKey,
  isActive,
}: {
  filterKey: SubscriptionSummaryCard["filterKey"];
  isActive?: boolean;
}) {
  if (isActive) {
    return filterKey === "all" ? "全件表示" : "フィルタ中";
  }

  return filterKey === "all" ? "すべて表示" : "絞り込む";
}

function resolveCriteriaChipLabel() {
  return "条件";
}

function isNumericSummaryValue(value: string) {
  return value.trim() !== "" && !Number.isNaN(Number(value));
}

function renderDefaultSummaryValue(card: SubscriptionSummaryCard) {
  if (isNumericSummaryValue(card.value)) {
    return <MotionNumber value={card.value} variant="digit-pop" />;
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

  const cardButton = (
    <button
      type="button"
      className={cn(
        cardClassName,
        "group cursor-pointer hover:border-border-strong/90 focus-visible:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45",
      )}
      aria-label={resolveSummaryFilterCardAriaLabel(summaryCard)}
      aria-pressed={Boolean(summaryCard.isActive)}
      onClick={() => onSelect(summaryCard.filterKey)}
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute inset-x-0 top-0 h-1.5 transition-opacity duration-150",
          toneClasses.activeAccent,
          summaryCard.isActive ? "opacity-100" : "opacity-0",
        )}
      />
      <div>
        <div className="mb-2 flex items-start justify-between gap-3">
          <SummaryText as="span" variant="label" className="block">
            {summaryCard.label}
          </SummaryText>
          <span data-testid="subscriptions-summary-card-badge-slot" className="flex min-w-[4.75rem] justify-end">
            <span
              className={cn(
                "inline-flex h-6 items-center rounded-full border border-border-strong/70 bg-surface-1 px-2.5 text-[10px] font-medium tracking-[0.12em] text-foreground uppercase shadow-[var(--subscriptions-summary-badge-shadow)]",
                summaryCard.isActive && toneClasses.activeBadge,
                !summaryCard.isActive && "invisible",
              )}
              aria-hidden={summaryCard.isActive ? undefined : "true"}
            >
              {resolveActiveBadgeLabel()}
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
      <div className="mt-2 flex items-center justify-between gap-3">
        <LabelChip
          tone="neutral"
          className={cn(
            "px-2 py-0.75 text-[10px] text-foreground-soft transition-colors duration-150 ease-standard group-hover:text-foreground motion-reduce:transition-none",
            summaryCard.isActive &&
              "border-border-strong/75 bg-surface-1 text-foreground shadow-[var(--subscriptions-summary-active-chip-shadow)]",
            isProminent && !summaryCard.isActive && "bg-surface-1/88",
          )}
        >
          {resolveActionChipLabel({ filterKey: summaryCard.filterKey, isActive: summaryCard.isActive })}
        </LabelChip>
        {shouldShowCriteria ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-border/55 bg-surface-1/76 px-2 py-0.75 text-[10px] font-medium text-foreground-soft transition-colors duration-150 ease-standard group-hover:border-border-strong/65 group-hover:text-foreground motion-reduce:transition-none">
            <Info className="size-3" aria-hidden="true" />
            {resolveCriteriaChipLabel()}
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
  onSelectFilter: (filterKey: SubscriptionSummaryCard["filterKey"]) => void;
  renderValue?: (card: SubscriptionSummaryCard) => ReactNode;
  reviewCriteriaLabel?: string;
};

export function SubscriptionsOverviewSummary({
  cards,
  onSelectFilter,
  renderValue,
  reviewCriteriaLabel,
}: SubscriptionsOverviewSummaryProps) {
  return (
    <section
      className="rounded-md border border-border/55 px-4 py-3 sm:px-5 sm:py-4"
      style={{
        backgroundColor: "var(--subscriptions-summary-surface)",
      }}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[repeat(auto-fit,minmax(13rem,1fr))] lg:gap-3.5">
        {cards.map((card) => {
          const { value, viewState } = buildSummaryCardRenderModel({ card, renderValue });

          if (viewState.isActionable) {
            return (
              <SummaryFilterCardButton
                key={card.label}
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
                    {resolveStaticBadgeLabel()}
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
